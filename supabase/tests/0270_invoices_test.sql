-- Phase 2 / inc-P1: invoices (MONEY) RLS — admin + owning customer see invoices; staff & manager are
-- money-blind (0 rows); cross-tenant invisible.
begin;
select plan(8);

select has_table('invoices', 'invoices table exists');
select ok((select relrowsecurity from pg_class where relname = 'invoices'), 'RLS on invoices');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3', '11111111-1111-1111-1111-111111111111', 'cust@a',  'Cus', 'customer');
insert into customers(id, tenant_id, user_id, name, status) values
  ('cccccccc-cccc-cccc-cccc-00000000c0c1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3', 'C1', 'claimed');
insert into invoices(tenant_id, customer_id, number, amount, provider, provider_ref) values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-00000000c0c1', 'HD-2026-001', 80, 'mock', 'mock_pi_test');

set local role authenticated;

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select is((select count(*) from invoices)::int, 1, 'admin sees the invoice');
select is((select amount from invoices)::numeric, 80::numeric, 'admin sees the invoice amount');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3"}';
select is((select count(*) from invoices)::int, 1, 'owning customer sees their invoice');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2"}';
select is((select count(*) from invoices)::int, 0, 'staff is money-blind to invoices (0 rows)');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select is((select count(*) from invoices)::int, 0, 'manager is money-blind to invoices (0 rows)');

set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select is((select count(*) from invoices)::int, 0, 'cross-tenant admin sees 0 invoices');

reset role;
select * from finish();
rollback;
