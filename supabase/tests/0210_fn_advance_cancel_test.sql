-- E0d increment 2: advance_order (state machine) + cancel_order (planned-only + 5% fee + refund).
-- Cancel allowed only before staff accepts (new|confirmed|assigned); refund minus a 5% fee.
begin;
select plan(9);

select has_function('advance_order', 'advance_order() exists');
select has_function('cancel_order', 'cancel_order() exists');

-- seed: a customer with $100 credit
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into customers(id, tenant_id, name, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'C1', 'claimed');
select topup('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 100, null);

-- OA: legal transition new → confirmed (admin)
select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'OA', 'Keyword', 10, null);
select advance_order((select id from orders where code = 'OA'), 'confirmed', null, 'admin');
select is((select state from orders where code = 'OA')::text, 'confirmed', 'advance_order applies a legal transition');

-- OB: illegal transition new → completed is rejected
select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'OB', 'Content', 10, null);
select throws_ok(
  $$ select advance_order((select id from orders where code = 'OB'), 'completed', null, 'admin') $$,
  'ILLEGAL_TRANSITION', 'advance_order rejects a transition not in allowed_transitions');

-- OC: cancel while "planned" (state new). Refund $30, withhold 5% = $1.50.
-- balance: 100 -10(OA) -10(OB) -30(OC) +30(refund) -1.50(fee) = 78.50
select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'OC', 'Audit', 30, null);
select cancel_order((select id from orders where code = 'OC'), null);
select is(
  (select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  78.50::numeric, 'cancel_order refunds the value minus a 5% fee');
select is((select state from orders where code = 'OC')::text, 'canceled', 'cancel_order moves the order to canceled');
select is(
  (select amount from credit_ledger where kind = 'cancel_fee')::numeric,
  -1.50::numeric, 'cancel_order withholds a 5% cancellation fee');
-- CRITICAL: the invariant holds across refund + fee
select is(
  (select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  (select coalesce(sum(amount), 0) from credit_ledger where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  'CRITICAL: balance == SUM(ledger) after refund + fee');

-- OD: once the staff has accepted (in_progress), the order can no longer be canceled.
select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'OD', 'Backlink', 10, null);
select advance_order((select id from orders where code = 'OD'), 'confirmed', null, 'admin');
select advance_order((select id from orders where code = 'OD'), 'assigned', null, 'admin');
select advance_order((select id from orders where code = 'OD'), 'in_progress', null, 'staff');
select throws_ok(
  $$ select cancel_order((select id from orders where code = 'OD'), null) $$,
  'NOT_CANCELABLE', 'cancel_order is rejected once the order is in_progress (staff accepted)');

select * from finish();
rollback;
