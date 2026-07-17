'use server';

import { revalidatePath } from 'next/cache';
import { resolveAddOns } from '@heva/catalog';
import { getServerSession, createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { computeOrderPrice } from '@/lib/orderPricing';
import { deadlineFromSla } from '@/lib/orderSla';
import { SERVICE_CATALOG } from '@/data/services';
import { SERVICES, type ServiceKey, type Order } from '@/data/mock';
import { getMyOrdersByProject } from '@/data/orders.server';
import { UUID_RE } from '@/lib/orderMap';
import type { Json } from '@/lib/supabase/database.types';

export type PlaceOrderInput = {
  serviceKey: ServiceKey;
  packageId: string;
  qty: number;
  addonPicks: Record<string, string>;
  project: string;
  folder: string;
  projectDomain?: string;    // the project's website; used to find-or-create the real projects row
  folderId?: string | null;  // a real folders.id when the customer picked one (else resolved by name)
  title?: string;            // optional campaign/order title; blank → "Nth {service} order for {domain}"
  site?: string;             // the website URL the customer entered (shown on the card)
  brief: { label: string; value: string; full?: boolean }[];
};

/** Resolve (find-or-create) the customer's real project + folder rows for an order, returning their ids so
 *  order_details can FK to them. Runs on the customer's RLS client (they own these rows). Best-effort:
 *  a failure here never blocks the order — the text project/folder still records the intent. */
async function resolveProjectLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string, customerId: string,
  input: PlaceOrderInput,
): Promise<{ projectId: string | null; folderId: string | null }> {
  let folderId: string | null = input.folderId && UUID_RE.test(input.folderId) ? input.folderId : null;
  const folderName = input.folder?.trim();
  if (!folderId && folderName) {
    const { data: f } = await supabase.from('folders').select('id').eq('name', folderName).limit(1);
    folderId = f?.[0]?.id ?? null;
    if (!folderId) {
      const { data: nf } = await supabase.from('folders')
        .insert({ tenant_id: tenantId, customer_id: customerId, name: folderName }).select('id').single();
      folderId = nf?.id ?? null;
    }
  }

  let projectId: string | null = null;
  const projectName = input.project?.trim();
  const domain = input.projectDomain?.trim() || null;
  if (domain || projectName) {
    if (domain) { const { data } = await supabase.from('projects').select('id').eq('domain', domain).limit(1); projectId = data?.[0]?.id ?? null; }
    if (!projectId && projectName) { const { data } = await supabase.from('projects').select('id').ilike('name', projectName).limit(1); projectId = data?.[0]?.id ?? null; }
    if (!projectId) {
      const { data: np } = await supabase.from('projects')
        .insert({ tenant_id: tenantId, customer_id: customerId, name: projectName || domain || 'Project', domain, folder_id: folderId, status: 'planned' })
        .select('id').single();
      projectId = np?.id ?? null;
    } else if (folderId) {
      // keep an existing project's folder in sync when the order targets a folder and it has none yet
      await supabase.from('projects').update({ folder_id: folderId }).eq('id', projectId).is('folder_id', null);
    }
  }
  return { projectId, folderId };
}
export type PlaceOrderResult = { ok: true; code: string } | { ok: false; error: string };

/** English ordinal: 1→"1st", 2→"2nd", 3→"3rd", 11→"11th", 21→"21st"… */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// Lane B inc-B3 — create a customer order from the dashboard, MONEY (gác③). The price is computed
// SERVER-SIDE (never trusted from the client) via computeOrderPrice using the real catalog + the
// customer's real tier; create_order (service-role-only) atomically debits credit (INSUFFICIENT_CREDIT
// if too low). order_details (brief) + order_addons (paid upsells) are persisted via the service role.
export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const session = await getServerSession();
  if (!session || session.role !== 'customer' || !session.entityId) return { ok: false, error: 'You must be signed in as a customer.' };

  // own customer row (RLS-scoped) → id + tenant + tier
  const supabase = await createClient();
  const { data: cust, error: cErr } = await supabase
    .from('customers').select('id, tenant_id, tier, company').maybeSingle();
  if (cErr) return { ok: false, error: cErr.message };
  if (!cust) return { ok: false, error: 'No customer profile found.' };

  const catalog = SERVICE_CATALOG[input.serviceKey];
  if (!catalog) return { ok: false, error: 'Unknown service.' };

  const priced = computeOrderPrice(catalog, {
    packageId: input.packageId, qty: input.qty, addonPicks: input.addonPicks, isVip: cust.tier === 'vip',
  });
  // A zero-value order is a free order. The catalog has packages priced 0 — 'Ultra' and 'Custom' under
  // Optimization carry price: 0 with priceLabel: 'Consult' (data/services.ts) — so a customer could pick
  // one here and create a real, unpaid order that entered the pipeline like any other: create_order only
  // rejects p_value < 0, and this action never checked. The public checkout has guarded exactly this
  // since it was written (api/public/checkout/route.ts: !hasNumericTotal → 422, !(value > 0) → 400);
  // the dashboard flow simply never got the same gate.
  //
  // Gate on the VALUE, not on hasNumericTotal. hasNumericTotal is also false for 'from $79'-style
  // packages that do charge their starting price here today — refusing those would change working
  // behaviour, and whether they should be quote-only is a product call, not a bug fix.
  if (!(priced.value > 0)) {
    return { ok: false, error: 'This plan needs a custom quote — talk to us and we’ll price it for you.' };
  }
  const serviceLabel = SERVICES[input.serviceKey]?.label ?? input.serviceKey;
  const code = `${catalog.orderCode}-${Math.floor(1000 + Math.random() * 9000)}`;
  const deadline = deadlineFromSla(priced.sla); // ETA from the chosen package's SLA

  const svc = createServiceClient();
  const { data: order, error } = await svc.rpc('create_order', {
    p_tenant: cust.tenant_id, p_customer: cust.id, p_code: code,
    p_service: serviceLabel, p_value: priced.value, p_actor: session.entityId, p_deadline: deadline ?? undefined,
  });
  if (error) {
    const msg = error.message.includes('INSUFFICIENT_CREDIT')
      ? 'Not enough credit — top up to place this order.' : error.message;
    return { ok: false, error: msg };
  }

  // link the order to REAL project/folder rows (find-or-create) so it shows up under its project, not just
  // as free text. Best-effort — never blocks the order.
  const { projectId, folderId } = await resolveProjectLink(supabase, cust.tenant_id, cust.id, input);

  // Campaign/order title: use the customer's, else auto "Nth {service} order for {domain}" where N counts
  // prior orders of this service in the same project.
  let title = input.title?.trim() || null;
  if (!title) {
    let prior = 0;
    if (projectId) {
      // prior orders of THIS service already filed in THIS project (the new order's details aren't inserted
      // yet). Read via the CUSTOMER client — service_role has no SELECT grant on order_details; the customer's
      // own-row RLS is exactly the scope we want here.
      const { data: dets } = await supabase.from('order_details').select('order_id').eq('project_id', projectId);
      const ids = (dets ?? []).map((d) => d.order_id);
      if (ids.length) {
        const { data: os } = await supabase.from('orders').select('id').in('id', ids).eq('service', serviceLabel);
        prior = (os ?? []).length;
      }
    }
    const forSite = input.projectDomain?.trim() || cust.company || 'your site';
    title = `${ordinal(prior + 1)} ${serviceLabel} order for ${forSite}`;
  }

  // persist the brief + paid add-ons (service role bypasses RLS; these belong to the order just made)
  await svc.from('order_details').insert({
    tenant_id: cust.tenant_id, order_id: order.id, project: input.project, folder: input.folder,
    project_id: projectId, folder_id: folderId, title, site: input.site?.trim() || null,
    brief: input.brief, included: [],
  });
  const addonRows = resolveAddOns(catalog.addons ?? [])
    .filter((a) => a.id in input.addonPicks)
    .map((a) => {
      const t = a.tiers.find((x) => x.id === input.addonPicks[a.id]) ?? a.tiers[0];
      return { tenant_id: cust.tenant_id, order_id: order.id, name: a.name, tier: t.name, price: t.price };
    });
  if (addonRows.length) await svc.from('order_addons').insert(addonRows);

  // If a manager is "away", route this fresh order to the least-loaded suitable staffer in their pod
  // automatically (skill + load aware, server-side). Best-effort — never blocks the order; a no-op when no
  // manager is away or the pod can't serve this skill.
  await svc.rpc('auto_assign_order', { p_order: order.id });

  revalidatePath('/orders');
  revalidatePath('/dashboard');
  revalidatePath('/manager/assignment');
  return { ok: true, code };
}

// Real, RLS-scoped detail for the customer order slide-over: the brief they submitted at order time
// (order_details), the delivered work they may read (deliverables — approved versions per RLS), and a
// small derived activity timeline. Resolved by order code (the customer Order model keys on code).
type BriefField = { label: string; value: string; full?: boolean };
type DelivStatus = 'approved' | 'delivered' | 'review' | 'rejected';
type DelivFile = { kind: 'file' | 'link'; name: string; meta?: string; url?: string };
type DelivRevision = { version: string; date: string; status: DelivStatus; note?: string; files?: DelivFile[]; feedback?: string };
type Deliverable = { name: string; status: DelivStatus; date: string; revisions: DelivRevision[] };
export type CustomerOrderDetail = {
  id: string; state: string; project: string | null; folder: string | null;
  brief: BriefField[]; deliverables: Deliverable[]; activity: { label: string; date: string }[];
};

const DELIV_STATUS: Record<string, DelivStatus> = {
  approved: 'approved', submitted: 'review', changes_requested: 'rejected',
};
const shortDate = (ts: string | null): string => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export async function getCustomerOrderDetailAction(code: string): Promise<CustomerOrderDetail | null> {
  const supabase = await createClient();
  const { data: ord, error: oErr } = await supabase.from('orders').select('id, created_at, delivered_at, state').eq('code', code).maybeSingle();
  if (oErr || !ord) return null;

  const [detailRes, delivRes] = await Promise.all([
    supabase.from('order_details').select('project, folder, brief').eq('order_id', ord.id).maybeSingle(),
    supabase.from('deliverables').select('summary, version, status, files, submitted_at').eq('order_id', ord.id).order('version', { ascending: false }),
  ]);

  const briefRaw = Array.isArray(detailRes.data?.brief) ? (detailRes.data!.brief as unknown[]) : [];
  const brief: BriefField[] = briefRaw
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map((b) => ({ label: String(b.label ?? ''), value: String(b.value ?? ''), full: Boolean(b.full) }))
    .filter((b) => b.label);

  const delivRows = delivRes.data ?? [];
  const hostOf = (url?: string): string | undefined => {
    if (!url) return undefined;
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return undefined; }
  };
  // Preserve each asset's real kind: a 'file' renders as a downloadable/previewable file, a 'link' shows
  // the URL the staffer included. (Previously everything was forced to 'link' and the filename was dropped.)
  const toFiles = (files: unknown): DelivFile[] => (Array.isArray(files) ? files : []).map((f, i) => {
    if (f && typeof f === 'object') {
      const o = f as Record<string, unknown>;
      const url = o.url ? String(o.url) : undefined;
      const kind: DelivFile['kind'] = o.kind === 'file' ? 'file' : 'link';
      const name = String(o.fileName ?? o.name ?? o.label ?? url ?? `Attachment ${i + 1}`);
      return { kind, name, meta: kind === 'link' ? hostOf(url) : undefined, url };
    }
    const url = typeof f === 'string' ? f : undefined;
    return { kind: 'link', name: url ?? `Attachment ${i + 1}`, meta: hostOf(url), url };
  });
  // Customer-facing status: manager-approving the work does NOT read as "Approved" to the customer — it's
  // "Ready for your review" until THEY approve. Only an order the customer accepted (approved/completed)
  // shows the Approved badge.
  const customerApproved = ['approved', 'completed'].includes(ord.state);
  const custStatus = (s: string): DelivStatus => {
    const base = DELIV_STATUS[s] ?? 'review';
    return base === 'approved' && !customerApproved ? 'delivered' : base;
  };
  const deliverables: Deliverable[] = delivRows.length
    ? [{
        name: 'Delivered work',
        status: custStatus(delivRows[0].status),
        date: shortDate(delivRows[0].submitted_at),
        revisions: delivRows.map((d) => ({
          version: `v${d.version}`, date: shortDate(d.submitted_at), status: custStatus(d.status),
          note: d.summary ?? undefined, files: toFiles(d.files),
        })),
      }]
    : [];

  const activity: { label: string; date: string }[] = [];
  if (ord.delivered_at) activity.push({ label: 'Delivered — awaiting your review', date: shortDate(ord.delivered_at) });
  for (const d of delivRows) activity.push({ label: `Deliverable v${d.version} ${(DELIV_STATUS[d.status] ?? 'submitted').replace('rejected', 'changes requested')}`, date: shortDate(d.submitted_at) });
  activity.push({ label: 'Order created', date: shortDate(ord.created_at) });

  return { id: ord.id, state: ord.state, project: detailRes.data?.project ?? null, folder: detailRes.data?.folder ?? null, brief, deliverables, activity };
}

// The customer opened the delivered work → stamp viewed_at (own order only; idempotent server-side). After
// this the staffer can no longer edit the delivery in place — further changes become a new revision.
export async function markDeliverableViewedAction(orderId: string): Promise<void> {
  if (!UUID_RE.test(orderId)) return;
  const supabase = await createClient();
  await supabase.rpc('mark_deliverable_viewed', { p_order: orderId });
}

/** Real orders linked to a project (order_details.project_id) — for the project detail page. */
export async function getProjectOrdersAction(projectId: string): Promise<Order[]> {
  return getMyOrdersByProject(projectId);
}

// The customer's post-delivery decision on a DELIVERED order: approve it (delivered → approved) or send
// it back for revision (delivered → changes_requested). advance_order derives role/ownership from the
// JWT and enforces the allowed-transitions rules, so this just forwards the customer's intent.
export type ReviewDeliveryResult = { ok: true } | { ok: false; error: string };
export async function reviewDeliveryAction(orderId: string, action: 'approve' | 'request_changes'): Promise<ReviewDeliveryResult> {
  const supabase = await createClient();
  const to = action === 'approve' ? 'approved' : 'changes_requested';
  const { error } = await supabase.rpc('advance_order', { p_order: orderId, p_to: to });
  if (error) {
    const map: Record<string, string> = {
      ILLEGAL_TRANSITION: 'This order can no longer be actioned.',
      NOT_AUTHORIZED: 'You can only review your own orders.',
      ORDER_NOT_FOUND: 'That order no longer exists.',
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { ok: false, error: key ? map[key] : error.message };
  }
  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { ok: true };
}

export type RevisionAttachment = { kind: 'image' | 'video'; url: string; name: string };
// Request changes WITH a required note (+ optional pasted media). Atomic: posts the note as an order
// message and advances delivered → changes_requested; if the note is empty or the transition is illegal,
// nothing happens.
export async function requestOrderChangesAction(orderId: string, note: string, attachments: RevisionAttachment[] = []): Promise<ReviewDeliveryResult> {
  if (!note.trim()) return { ok: false, error: 'Please describe what needs revising.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_order_changes', {
    p_order: orderId, p_note: note.trim(), p_attachments: attachments as unknown as Json,
  });
  if (error) {
    const map: Record<string, string> = {
      EMPTY_NOTE: 'Please describe what needs revising.',
      ILLEGAL_TRANSITION: 'This order can no longer be sent back.',
      NOT_AUTHORIZED: 'You can only review your own orders.',
      ORDER_NOT_FOUND: 'That order no longer exists.',
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { ok: false, error: key ? map[key] : error.message };
  }
  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { ok: true };
}
