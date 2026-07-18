-- set_staff_comp (20260711120000) — the admin's pay-rate mutation. It sets base_salary + commission_pct,
-- and those two numbers ARE the payroll accrual: getPayrollPreview computes commission = basis × pct%,
-- outstanding = base + commission − paid. A wrong rate here mis-pays every cycle, so who may set it, and
-- what values it accepts, are money-critical — and until now untested.
--
-- Pins: admin-only (managers are money-blind — they cannot set pay), the value guards (salary ≥ 0,
-- 0 ≤ rate ≤ 100), the target guard (staff/manager only), upsert semantics, and the RLS read scope
-- (admin sees the tenant, a person sees only their own line, nobody sees a colleague's).
begin;
select plan(18);

-- ── grants (static) ──────────────────────────────────────────────────────────────────────────────────
select has_function('set_staff_comp', 'set_staff_comp() exists');
select ok(not has_function_privilege('anon', 'set_staff_comp(uuid,numeric,numeric)', 'execute'), 'anon cannot set comp');
select ok(has_function_privilege('authenticated', 'set_staff_comp(uuid,numeric,numeric)', 'execute'), 'authenticated may call it (admin gate is inside)');
-- the table takes no direct writes — everything must go through the fn, so the admin check can't be bypassed
select ok(not has_table_privilege('authenticated', 'staff_comp', 'insert'), 'no direct INSERT on staff_comp');
select ok(not has_table_privilege('authenticated', 'staff_comp', 'update'), 'no direct UPDATE on staff_comp');
select ok(not has_table_privilege('authenticated', 'staff_comp', 'delete'), 'no direct DELETE on staff_comp');

-- ── fixture ──────────────────────────────────────────────────────────────────────────────────────────
insert into tenants(id, name) values ('44444444-4444-4444-4444-444444444444', 'Comp');
insert into profiles(id, tenant_id, email, name, role) values
  ('44440000-0000-4000-8000-0000000000a0', '44444444-4444-4444-4444-444444444444', 'adm@c', 'Adm', 'admin'),
  ('44440000-0000-4000-8000-0000000000a1', '44444444-4444-4444-4444-444444444444', 'mgr@c', 'Mgr', 'manager'),
  ('44440000-0000-4000-8000-0000000000b1', '44444444-4444-4444-4444-444444444444', 's1@c',  'S1',  'staff'),
  ('44440000-0000-4000-8000-0000000000b2', '44444444-4444-4444-4444-444444444444', 's2@c',  'S2',  'staff'),
  ('44440000-0000-4000-8000-0000000000c1', '44444444-4444-4444-4444-444444444444', 'cus@c', 'Cus', 'customer');

set local role authenticated;

-- ── the pay dial is admin-only (managers are money-blind — this is the point of pay-blindness) ─────────
set local request.jwt.claims = '{"tenant_id":"44444444-4444-4444-4444-444444444444","app_role":"staff","profile_id":"44440000-0000-4000-8000-0000000000b1"}';
select throws_ok($$ select set_staff_comp('44440000-0000-4000-8000-0000000000b1'::uuid, 1000, 10) $$, 'NOT_ADMIN', 'a staffer cannot set pay');
set local request.jwt.claims = '{"tenant_id":"44444444-4444-4444-4444-444444444444","app_role":"manager","profile_id":"44440000-0000-4000-8000-0000000000a1"}';
select throws_ok($$ select set_staff_comp('44440000-0000-4000-8000-0000000000b1'::uuid, 1000, 10) $$, 'NOT_ADMIN', 'CRITICAL: a manager cannot set pay — money-blindness covers the pay dial too');
set local request.jwt.claims = '{"tenant_id":"44444444-4444-4444-4444-444444444444","app_role":"customer","profile_id":"44440000-0000-4000-8000-0000000000c1"}';
select throws_ok($$ select set_staff_comp('44440000-0000-4000-8000-0000000000b1'::uuid, 1000, 10) $$, 'NOT_ADMIN', 'a customer cannot set pay');

-- ── value + target guards (as admin) ─────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"tenant_id":"44444444-4444-4444-4444-444444444444","app_role":"admin","profile_id":"44440000-0000-4000-8000-0000000000a0"}';
select throws_ok($$ select set_staff_comp('44440000-0000-4000-8000-0000000000b1'::uuid, -1, 10) $$,  'BAD_SALARY', 'a negative salary is rejected');
select throws_ok($$ select set_staff_comp('44440000-0000-4000-8000-0000000000b1'::uuid, 1000, 150) $$, 'BAD_RATE',  'a commission rate over 100% is rejected');
select throws_ok($$ select set_staff_comp('44440000-0000-4000-8000-0000000000c1'::uuid, 1000, 10) $$,  'NOT_STAFF_OR_MANAGER', 'pay cannot be set for a customer');

-- ── the happy path + upsert ──────────────────────────────────────────────────────────────────────────
select is((set_staff_comp('44440000-0000-4000-8000-0000000000b1'::uuid, 1000, 10)).base_salary,   1000::numeric, 'admin sets base salary');
select is((set_staff_comp('44440000-0000-4000-8000-0000000000b1'::uuid, 1000, 10)).commission_pct, 10::numeric,   'admin sets commission rate');
-- setting again upserts the SAME row (one comp line per person), it does not stack
select is((set_staff_comp('44440000-0000-4000-8000-0000000000b1'::uuid, 1200, 15)).base_salary,   1200::numeric, 'a second set updates the salary');
select is((select count(*) from staff_comp where profile_id = '44440000-0000-4000-8000-0000000000b1')::int, 1, 'still exactly one comp row for the person (upsert, not insert)');

-- ── RLS read scope: admin sees the tenant, a person sees only their own line ──────────────────────────
set local request.jwt.claims = '{"tenant_id":"44444444-4444-4444-4444-444444444444","app_role":"staff","profile_id":"44440000-0000-4000-8000-0000000000b1"}';
select is((select count(*) from staff_comp where profile_id = '44440000-0000-4000-8000-0000000000b1')::int, 1, 'a staffer can read their OWN comp line (their finance page needs it)');
set local request.jwt.claims = '{"tenant_id":"44444444-4444-4444-4444-444444444444","app_role":"staff","profile_id":"44440000-0000-4000-8000-0000000000b2"}';
select is((select count(*) from staff_comp where profile_id = '44440000-0000-4000-8000-0000000000b1')::int, 0, 'CRITICAL: a staffer cannot read a colleague''s pay');

select * from finish();
rollback;
