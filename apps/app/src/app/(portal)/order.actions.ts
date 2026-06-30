'use server';

import { revalidatePath } from 'next/cache';
import { resolveAddOns } from '@heva/catalog';
import { getServerSession, createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { computeOrderPrice } from '@/lib/orderPricing';
import { SERVICE_CATALOG } from '@/data/services';
import { SERVICES, type ServiceKey } from '@/data/mock';

export type PlaceOrderInput = {
  serviceKey: ServiceKey;
  packageId: string;
  qty: number;
  addonPicks: Record<string, string>;
  project: string;
  folder: string;
  brief: { label: string; value: string; full?: boolean }[];
};
export type PlaceOrderResult = { ok: true; code: string } | { ok: false; error: string };

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
    .from('customers').select('id, tenant_id, tier').maybeSingle();
  if (cErr) return { ok: false, error: cErr.message };
  if (!cust) return { ok: false, error: 'No customer profile found.' };

  const catalog = SERVICE_CATALOG[input.serviceKey];
  if (!catalog) return { ok: false, error: 'Unknown service.' };

  const price = computeOrderPrice(catalog, {
    packageId: input.packageId, qty: input.qty, addonPicks: input.addonPicks, isVip: cust.tier === 'vip',
  }).value;
  const serviceLabel = SERVICES[input.serviceKey]?.label ?? input.serviceKey;
  const code = `${catalog.orderCode}-${Math.floor(1000 + Math.random() * 9000)}`;

  const svc = createServiceClient();
  const { data: order, error } = await svc.rpc('create_order', {
    p_tenant: cust.tenant_id, p_customer: cust.id, p_code: code,
    p_service: serviceLabel, p_value: price, p_actor: session.entityId,
  });
  if (error) {
    const msg = error.message.includes('INSUFFICIENT_CREDIT')
      ? 'Not enough credit — top up to place this order.' : error.message;
    return { ok: false, error: msg };
  }

  // persist the brief + paid add-ons (service role bypasses RLS; these belong to the order just made)
  await svc.from('order_details').insert({
    tenant_id: cust.tenant_id, order_id: order.id, project: input.project, folder: input.folder,
    brief: input.brief, included: [],
  });
  const addonRows = resolveAddOns(catalog.addons ?? [])
    .filter((a) => a.id in input.addonPicks)
    .map((a) => {
      const t = a.tiers.find((x) => x.id === input.addonPicks[a.id]) ?? a.tiers[0];
      return { tenant_id: cust.tenant_id, order_id: order.id, name: a.name, tier: t.name, price: t.price };
    });
  if (addonRows.length) await svc.from('order_addons').insert(addonRows);

  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { ok: true, code };
}
