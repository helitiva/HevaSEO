import { createClient } from '@supabase/supabase-js';

// Small API-seeding helper for UI journeys that need pre-existing state (e.g. a pending payout to
// resolve). Uses the same env as the backend E2E; when creds are absent the journey test skips.
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SMOKE_ANON;
const SVC = process.env.SMOKE_SVC;
export const hasApiCreds = Boolean(ANON && SVC);
const MAI = 'b000aaaa-0000-4000-8000-000000000003';

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
  const { data } = await admin.from('orders').select('id,code,state').is('assignee_id', null).in('state', ['new', 'confirmed']).limit(1);
  const o = data?.[0];
  if (!o) return null;
  // real admin flow: confirm first (new→confirmed) so the assign lands the order in 'assigned' (a staff
  // board column); assigning a raw 'new' order would leave it 'new' and only show in the list view.
  if (o.state === 'new') await admin.rpc('advance_order', { p_order: o.id, p_to: 'confirmed' });
  const { error } = await admin.rpc('assign_order', { p_order: o.id, p_staff: MAI });
  if (error) throw new Error(`assignOpenOrderToMai: ${error.message}`);
  return o.code as string;
}
