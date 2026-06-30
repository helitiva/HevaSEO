-- Phase 2 / inc-Q1: materialize_order — atomic quick-checkout (topup + order in one txn), idempotent
-- by checkout_ref, service-role-only. CRITICAL: never sell credit without an order; a retried payment
-- yields the SAME order, not a second.
begin;
select plan(10);

select has_function('materialize_order', 'materialize_order() exists');

-- (chốt 1) value is client-untrusted → only service_role may call it (not the public API roles).
select ok(
  not has_function_privilege('authenticated', 'materialize_order(uuid,uuid,text,text,numeric,uuid,text)', 'execute'),
  'authenticated CANNOT execute materialize_order');
select ok(
  not has_function_privilege('anon', 'materialize_order(uuid,uuid,text,text,numeric,uuid,text)', 'execute'),
  'anon CANNOT execute materialize_order');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into customers(id, tenant_id, name, status, email) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'C1', 'claimed', 'c1@a');

-- quick checkout: pay for a $50 audit
select materialize_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Q-1', 'Audit', 50, null, 'pay_ref_1');

select is((select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  0::numeric, 'balance nets to 0 (topup 50 − order 50)');
select is((select count(*) from orders where tenant_id = '11111111-1111-1111-1111-111111111111')::int, 1, 'one order created');
select is((select source::text from orders where checkout_ref = 'pay_ref_1'), 'quick', 'order source = quick');

-- CRITICAL invariant: balance == SUM(ledger)
select is(
  (select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  (select coalesce(sum(amount), 0) from credit_ledger where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  'CRITICAL: balance == SUM(credit_ledger)');

-- (chốt 3) idempotency: same payment ref → same order, no second order, balance unchanged
select materialize_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Q-1b', 'Audit', 50, null, 'pay_ref_1');
select is((select count(*) from orders where tenant_id = '11111111-1111-1111-1111-111111111111')::int, 1, 'idempotent: re-running the same payment makes no second order');
select is((select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  0::numeric, 'idempotent: balance unchanged on replay');

-- a distinct payment ref makes a new order
select materialize_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Q-2', 'Keyword', 20, null, 'pay_ref_2');
select is((select count(*) from orders where tenant_id = '11111111-1111-1111-1111-111111111111')::int, 2, 'a new payment ref creates a second order');

select * from finish();
rollback;
