-- E0d increment 1: topup + create_order atomic money functions.
-- CRITICAL: the debit is atomic (no negative balance), and balance always equals SUM(ledger).
begin;
select plan(10);

select has_function('topup', 'topup() exists');
select has_function('create_order', 'create_order() exists');

-- seed
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into customers(id, tenant_id, name, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'C1', 'claimed');

-- topup $100
select topup('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 100, null);
select is(
  (select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  100::numeric, 'topup sets balance to 100');
select is((select count(*) from credit_ledger where kind = 'topup')::int, 1, 'topup writes a ledger entry');

-- create_order $30 (atomic debit)
select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'O-1', 'Keyword', 30, null);
select is(
  (select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  70::numeric, 'create_order debits balance to 70');
select is((select count(*) from orders where tenant_id = '11111111-1111-1111-1111-111111111111')::int, 1, 'create_order creates the order');
select is(
  (select amount from credit_ledger where kind = 'debit')::numeric,
  -30::numeric, 'create_order writes a -30 debit ledger entry');

-- CRITICAL reconciliation invariant: authoritative balance == SUM(ledger)
select is(
  (select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  (select coalesce(sum(amount), 0) from credit_ledger where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  'CRITICAL: balance == SUM(credit_ledger) (reconciliation invariant)');

-- CRITICAL: insufficient credit is rejected, and nothing changes
select throws_ok(
  $$ select create_order('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'O-2', 'Content', 9999, null) $$,
  'INSUFFICIENT_CREDIT', 'CRITICAL: create_order rejects when balance < price');
select is(
  (select balance from customer_balances where customer_id = '00000000-0000-0000-0000-000000000001')::numeric,
  70::numeric, 'balance unchanged after a rejected order');

select * from finish();
rollback;
