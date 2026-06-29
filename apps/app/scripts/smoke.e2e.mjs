// End-to-end smoke for the wired backend (Lane A). Drives the REAL local DB through Supabase Auth +
// RLS + the order RPCs across all roles, on the pristine seed. Not a unit test — needs the local
// stack running and a fresh seed.
//
//   pnpm db:reset && docker restart supabase_kong_<project>   # pristine + refresh gateway
//   SMOKE_URL=http://127.0.0.1:54321 \
//   SMOKE_ANON=<anon key>  SMOKE_SVC=<service_role key> \
//     node apps/app/scripts/smoke.e2e.mjs                      # keys from `pnpm db:start`/`supabase status`
//
// Exits non-zero on any failure. Asserts: auth+claims (5 roles), RLS reads (admin-all / customer-own /
// staff money-blind / manager money-stripped view / cross-customer isolation), order lifecycle
// (create→advance→cancel), security (role-forgery + non-owner writes blocked), money invariant.
import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSvc } from '@supabase/supabase-js';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SMOKE_ANON;
const SVC = process.env.SMOKE_SVC;
if (!ANON || !SVC) { console.error('Set SMOKE_ANON and SMOKE_SVC (from `pnpm db:start`).'); process.exit(2); }

const AGENCY = 'a9e0c0de-0000-4000-8000-000000000001';
const ACME = 'c0000000-0000-4000-8000-000000000001';
let pass = 0, fail = 0;
const ok = (c, l) => { console.log(`${c ? '  PASS' : '  FAIL'}  ${l}`); c ? pass++ : fail++; };
const sess = () => { const j = new Map(); return createBrowserClient(URL, ANON, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: cs => cs.forEach(({ name, value }) => j.set(name, value)) } }); };
const login = async (e) => { const s = sess(); const { error } = await s.auth.signInWithPassword({ email: e, password: 'demo1234' }); if (error) throw new Error(e + ' ' + error.message); return s; };
const role = (s) => s.auth.getSession().then(({ data }) => JSON.parse(Buffer.from(data.session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64')).app_role);
const svc = createSvc(URL, SVC, { auth: { persistSession: false } });

console.log('\n== A. AUTH (5 roles + JWT claim) ==');
for (const [e, w] of [['admin@hevaseo.com', 'admin'], ['sofia@hevaseo.com', 'manager'], ['mai@hevaseo.com', 'staff'], ['jane@acme.com', 'customer'], ['jane@janeseo.com', 'affiliate']]) {
  try { ok(await role(await login(e)) === w, `${e} → ${w}`); } catch (x) { ok(false, e + ': ' + x.message); }
}

console.log('\n== B. READS (RLS-scoped, pristine seed) ==');
const A = await login('admin@hevaseo.com'), J = await login('jane@acme.com'), S = await login('mai@hevaseo.com'), M = await login('sofia@hevaseo.com');
ok((await A.from('orders').select('id')).data.length === 11, 'admin sees 11 orders');
ok((await A.from('customers').select('id')).data.length === 6, 'admin sees 6 customers');
ok((await A.from('profiles').select('id').eq('role', 'staff')).data.length === 6, 'admin sees 6 staff');
const jo = (await J.from('orders').select('id,customer_id')).data;
ok(jo.length === 3 && jo.every(o => o.customer_id === ACME), 'customer sees ONLY her 3 Acme orders');
ok((await J.from('customers').select('id')).data.length === 1, 'customer sees only own customer');
ok((await S.from('orders').select('id')).data.length === 0, 'staff sees 0 base orders (money-blind)');
ok((await M.from('orders_mgr').select('code').limit(1)).data.length > 0 && !!(await M.from('orders_mgr').select('value').limit(1)).error, 'manager orders_mgr: rows readable, value column ABSENT');
ok(((await S.from('customer_balances').select('balance')).data?.length ?? 0) === 0, 'staff cannot read customer_balances');
const other = (await A.from('orders').select('id,customer_id')).data.find(o => o.customer_id !== ACME);
ok((await J.from('orders').select('id').eq('id', other.id)).data.length === 0, "customer cannot read another customer's order");

console.log('\n== C. ORDER LIFECYCLE + SECURITY ==');
await svc.rpc('topup', { p_tenant: AGENCY, p_customer: ACME, p_amount: 300, p_actor: null });
const co = await svc.rpc('create_order', { p_tenant: AGENCY, p_customer: ACME, p_code: 'SMOKE', p_service: 'Keyword', p_value: 60, p_actor: null });
ok(!co.error && co.data.state === 'new', 'service-role create_order → new');
const oid = co.data.id;
ok(!(await A.rpc('advance_order', { p_order: oid, p_to: 'confirmed' })).error, 'admin advance new→confirmed');
ok(!!(await J.rpc('advance_order', { p_order: oid, p_to: 'assigned' })).error, 'customer forge advance → BLOCKED');
ok((await A.rpc('cancel_order', { p_order: oid })).data?.state === 'canceled', 'admin cancel → canceled');
ok(!!(await S.rpc('cancel_order', { p_order: (await A.from('orders').select('id').eq('state', 'new').limit(1)).data[0].id })).error, 'staff cancel → BLOCKED');
ok(!!(await J.rpc('create_order', { p_tenant: AGENCY, p_customer: ACME, p_code: 'HACK', p_service: 'X', p_value: 0, p_actor: null })).error, 'customer create_order → permission denied');

console.log('\n== D. MONEY INVARIANT (balance == SUM(ledger)) ==');
const bal = Number((await A.from('customer_balances').select('balance').eq('customer_id', ACME).single()).data.balance);
const sum = (await A.from('credit_ledger').select('amount').eq('customer_id', ACME)).data.reduce((s, r) => s + Number(r.amount), 0);
ok(bal === Number(sum.toFixed(2)), `Acme balance ${bal} == SUM(ledger) ${sum.toFixed(2)}`);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
