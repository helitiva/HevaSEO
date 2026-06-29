-- E0d increment 2 (HARDENED inc-4 prep): advance_order/cancel_order now derive actor/role/tenant
-- from JWT claims (no trusted params) and enforce per-role ownership. Cancel allowed only before staff
-- accepts (new|confirmed|assigned); refund minus a 5% fee. These tests set request.jwt.claims to
-- simulate each role and prove role-forgery + cross-ownership are rejected.
begin;
select plan(14);

select has_function('advance_order', 'advance_order() exists');
select has_function('cancel_order', 'cancel_order() exists');

-- seed: tenant, actor profiles (audit_log.actor_id FK), a customer with $100 credit
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, user_id, email, name, role) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', null, 'admin@a', 'Admin', 'admin'),
  ('a0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', null, 'staff@a', 'Staff', 'staff'),
  ('a0000000-0000-0000-0000-0000000000a3', '11111111-1111-1111-1111-111111111111', null, 'cust@a',  'Cust',  'customer');
insert into customers(id, tenant_id, user_id, name, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-0000000000a3', 'C1', 'claimed');
select topup('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 100, null);

-- create_order is service-side; tests call it as superuser with params (unchanged signature).
select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'OA', 'Keyword', 10, null);
select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'OB', 'Content', 10, null);
select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'OC', 'Audit', 30, null);

-- ── as ADMIN ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"a0000000-0000-0000-0000-0000000000a1"}', true);
select advance_order((select id from orders where code = 'OA'), 'confirmed');
select is((select state from orders where code = 'OA')::text, 'confirmed', 'admin applies a legal transition');
select throws_ok(
  $$ select advance_order((select id from orders where code = 'OB'), 'completed') $$,
  'ILLEGAL_TRANSITION', 'admin cannot make a transition absent from allowed_transitions');

-- ── role-forgery is impossible: the CLAIM role is used, not a parameter ────────
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"a0000000-0000-0000-0000-0000000000a3"}', true);
select throws_ok(
  $$ select advance_order((select id from orders where code = 'OB'), 'confirmed') $$,
  'ILLEGAL_TRANSITION', 'a customer-claim CANNOT perform an admin-only transition (no role forgery)');

-- ── staff ownership: a staffer cannot advance an order not assigned to them ────
-- admin routes OB new→confirmed→assigned (assignee left null)
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"a0000000-0000-0000-0000-0000000000a1"}', true);
select advance_order((select id from orders where code = 'OB'), 'confirmed');
select advance_order((select id from orders where code = 'OB'), 'assigned');
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"a0000000-0000-0000-0000-0000000000a2"}', true);
select throws_ok(
  $$ select advance_order((select id from orders where code = 'OB'), 'in_progress') $$,
  'NOT_YOUR_ORDER', 'staff cannot advance an order assigned to someone else');

-- ── cancel by ADMIN: refund value − 5% fee ────────────────────────────────────
-- balance: 100 −10(OA) −10(OB) −30(OC) +30(refund) −1.50(fee) = 78.50
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"a0000000-0000-0000-0000-0000000000a1"}', true);
select cancel_order((select id from orders where code = 'OC'));
select is(
  (select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  78.50::numeric, 'cancel_order refunds the value minus a 5% fee');
select is((select state from orders where code = 'OC')::text, 'canceled', 'cancel_order moves the order to canceled');
select is(
  (select amount from credit_ledger where kind = 'cancel_fee')::numeric,
  -1.50::numeric, 'cancel_order withholds a 5% cancellation fee');
select is(
  (select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  (select coalesce(sum(amount), 0) from credit_ledger where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  'CRITICAL: balance == SUM(ledger) after refund + fee');

-- ── non-owner cannot cancel; in_progress cannot be canceled ───────────────────
-- a staffer (not admin, not the owning customer) is rejected
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"a0000000-0000-0000-0000-0000000000a2"}', true);
select throws_ok(
  $$ select cancel_order((select id from orders where code = 'OA')) $$,
  'NOT_AUTHORIZED', 'a staffer cannot cancel an order (only admin or the owning customer)');

-- the OWNING customer CAN cancel their own planned order
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"a0000000-0000-0000-0000-0000000000a3"}', true);
select lives_ok(
  $$ select cancel_order((select id from orders where code = 'OA')) $$,
  'the owning customer can cancel their own planned order');
select is((select state from orders where code = 'OA')::text, 'canceled', 'customer self-cancel moves order to canceled');

-- OD: once in_progress (staff accepted), cancel is rejected. Assign to the staffer first.
select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'OD', 'Backlink', 10, null);
update orders set assignee_id = 'a0000000-0000-0000-0000-0000000000a2' where code = 'OD';
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"a0000000-0000-0000-0000-0000000000a1"}', true);
select advance_order((select id from orders where code = 'OD'), 'confirmed');
select advance_order((select id from orders where code = 'OD'), 'assigned');
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"a0000000-0000-0000-0000-0000000000a2"}', true);
select advance_order((select id from orders where code = 'OD'), 'in_progress');
select set_config('request.jwt.claims',
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"a0000000-0000-0000-0000-0000000000a1"}', true);
select throws_ok(
  $$ select cancel_order((select id from orders where code = 'OD')) $$,
  'NOT_CANCELABLE', 'cancel_order is rejected once the order is in_progress');

select * from finish();
rollback;
