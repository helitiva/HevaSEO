import { createClient } from '@supabase/supabase-js';

// Small API-seeding helper for UI journeys that need pre-existing state (e.g. a pending payout to
// resolve). Uses the same env as the backend E2E; when creds are absent the journey test skips.
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SMOKE_ANON;
const SVC = process.env.SMOKE_SVC;
export const hasApiCreds = Boolean(ANON && SVC);
const MAI = 'b000aaaa-0000-4000-8000-000000000003';
const AGENCY = 'a9e0c0de-0000-4000-8000-000000000001';
const ACME = 'c0000000-0000-4000-8000-000000000001';

// Seed a submitted deliverable inside Sofia's pod (Mai's), leaving the order in `internal_review` — so
// the manager Review board has a live pod item to approve / send back. Returns the order code.
export async function seedSubmittedDeliverableForPod(): Promise<string | null> {
  if (!hasApiCreds) return null;
  const svc = createClient(URL, SVC!, { auth: { persistSession: false } });
  const admin = createClient(URL, ANON!, { auth: { persistSession: false } });
  await admin.auth.signInWithPassword({ email: 'admin@hevaseo.com', password: 'demo1234' });
  const code = `RVW-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.toUpperCase();
  await svc.rpc('topup', { p_tenant: AGENCY, p_customer: ACME, p_amount: 200, p_actor: null });
  const { data: ord, error: ce } = await svc.rpc('create_order', { p_tenant: AGENCY, p_customer: ACME, p_code: code, p_service: 'Audit', p_value: 60, p_actor: null });
  if (ce) throw new Error(`seed create_order: ${ce.message}`);
  const oid = (ord as { id: string }).id;
  await admin.rpc('advance_order', { p_order: oid, p_to: 'confirmed' });
  await admin.rpc('assign_order', { p_order: oid, p_staff: MAI });
  const mai = createClient(URL, ANON!, { auth: { persistSession: false } });
  await mai.auth.signInWithPassword({ email: 'mai@hevaseo.com', password: 'demo1234' });
  await mai.rpc('advance_order', { p_order: oid, p_to: 'in_progress' });
  await mai.rpc('advance_order', { p_order: oid, p_to: 'internal_review' });
  const { error: se } = await mai.rpc('submit_deliverable', { p_order: oid, p_summary: 'E2E draft for pod review', p_files: [] });
  if (se) throw new Error(`seed submit_deliverable: ${se.message}`);
  return code;
}

// Credit Mai's wallet (service-role) then have Mai request a $50 payout (claims-derived) → returns the
// pending request id for the admin UI to resolve.
export async function seedPendingStaffPayout(): Promise<string | null> {
  if (!hasApiCreds) return null;
  const svc = createClient(URL, SVC!, { auth: { persistSession: false } });
  const admin = createClient(URL, ANON!, { auth: { persistSession: false } });
  await admin.auth.signInWithPassword({ email: 'admin@hevaseo.com', password: 'demo1234' });
  const { data: orders } = await admin.from('orders').select('id').eq('assignee_id', MAI).limit(1);
  if (orders?.[0]) await svc.rpc('post_staff_pay', { p_order: orders[0].id, p_staff: MAI, p_commission: 300, p_gig: 0, p_actor: null });
  const mai = createClient(URL, ANON!, { auth: { persistSession: false } });
  await mai.auth.signInWithPassword({ email: 'mai@hevaseo.com', password: 'demo1234' });
  const { data: req, error } = await mai.rpc('request_payout', { p_amount: 50 });
  if (error) throw new Error(`seedPendingStaffPayout: ${error.message}`);
  return (req as { id: string }).id;
}

// Find an order still in `new` state (via the admin client) for the admin-advance UI journey.
export async function getNewOrderId(): Promise<string | null> {
  if (!hasApiCreds) return null;
  const admin = createClient(URL, ANON!, { auth: { persistSession: false } });
  await admin.auth.signInWithPassword({ email: 'admin@hevaseo.com', password: 'demo1234' });
  const { data } = await admin.from('orders').select('id').eq('state', 'new').limit(1);
  return data?.[0]?.id ?? null;
}

// Admin assigns an OPEN unassigned order to Mai (staff) and returns its code — for the cross-role
// "admin assign → staff sees the task" journey.
export async function assignOpenOrderToMai(): Promise<string | null> {
  if (!hasApiCreds) return null;
  const admin = createClient(URL, ANON!, { auth: { persistSession: false } });
  await admin.auth.signInWithPassword({ email: 'admin@hevaseo.com', password: 'demo1234' });
  // AUD-1001 is the stable unassigned fixture the manager-Assignment render test asserts on — never
  // consume it here, or that test flakes depending on worker ordering.
  const { data } = await admin.from('orders').select('id,code,state').is('assignee_id', null).in('state', ['new', 'confirmed']).neq('code', 'AUD-1001').limit(1);
  const o = data?.[0];
  if (!o) return null;
  // real admin flow: confirm first (new→confirmed) so the assign lands the order in 'assigned' (a staff
  // board column); assigning a raw 'new' order would leave it 'new' and only show in the list view.
  if (o.state === 'new') await admin.rpc('advance_order', { p_order: o.id, p_to: 'confirmed' });
  const { error } = await admin.rpc('assign_order', { p_order: o.id, p_staff: MAI });
  if (error) throw new Error(`assignOpenOrderToMai: ${error.message}`);
  return o.code as string;
}
