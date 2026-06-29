-- E0b money increment 1: customer credit RLS — CRITICAL money-isolation tests (ADR §9).
-- The staff=0 and manager=0 assertions are the money-blind guarantees; they MUST hold.
begin;
select plan(12);

-- structure
select has_table('customer_balances', 'customer_balances table exists');
select has_table('credit_ledger', 'credit_ledger table exists');
select ok((select relrowsecurity from pg_class where relname = 'customer_balances'), 'RLS on customer_balances');
select ok((select relrowsecurity from pg_class where relname = 'credit_ledger'), 'RLS on credit_ledger');

-- seed as superuser (bypasses RLS)
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c@a.com', 'Cust', 'customer');
insert into customers(id, tenant_id, user_id, name, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'C1', 'claimed'),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', null, 'C2', 'shadow');
insert into customer_balances(customer_id, tenant_id, balance) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 100.00),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 50.00);
insert into credit_ledger(tenant_id, customer_id, amount, kind) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 150.00, 'topup'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', -50.00, 'debit');

set local role authenticated;

-- admin sees all tenant balances + ledger
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from customer_balances)::int, 2, 'admin sees all tenant balances');
select is((select count(*) from credit_ledger)::int, 2, 'admin sees all tenant ledger entries');

-- customer sees only their own balance + ledger
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from customer_balances)::int, 1, 'customer sees only their own balance');
select is((select count(*) from credit_ledger)::int, 2, 'customer sees only their own ledger entries');

-- CRITICAL: staff sees NO money (balances or ledger) — money-blind
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from customer_balances)::int, 0, 'CRITICAL: staff sees 0 balances (money hidden)');
select is((select count(*) from credit_ledger)::int, 0, 'CRITICAL: staff sees 0 ledger entries (money hidden)');

-- CRITICAL: manager sees NO money — money-blind
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager"}';
select is((select count(*) from customer_balances)::int, 0, 'CRITICAL: manager sees 0 balances (money-blind)');

-- cross-tenant admin sees nothing of tenant A
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from customer_balances)::int, 0, 'cross-tenant admin sees 0 balances');

reset role;
select * from finish();
rollback;
