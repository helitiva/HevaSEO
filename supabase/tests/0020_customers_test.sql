-- E0b increment 2: customers structure + role-aware RLS.
-- Exercises the role layer (admin/manager vs customer vs staff) on top of tenant isolation.
begin;
select plan(7);

select has_table('customers', 'customers table exists');
select has_column('customers', 'tenant_id', 'customers.tenant_id exists');
select ok(
  (select relrowsecurity from pg_class where relname = 'customers'),
  'RLS is enabled on customers'
);

-- seed as superuser (bypasses RLS)
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'cust@a.com', 'Cust A', 'customer');
insert into customers(tenant_id, user_id, name, status) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Linked Cust', 'claimed'),
  ('11111111-1111-1111-1111-111111111111', null, 'Shadow Cust', 'shadow');

set local role authenticated;

-- admin of tenant A sees all tenant customers
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from customers)::int, 2, 'admin sees all tenant customers');

-- the customer sees only their own record
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from customers)::int, 1, 'customer sees only their own record');

-- staff sees no customers (not ops, not owner)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff"}';
select is((select count(*) from customers)::int, 0, 'staff sees no customers by default');

-- admin of a different tenant sees none of tenant A (cross-tenant isolation)
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from customers)::int, 0, 'cross-tenant admin sees 0 customers');

reset role;
select * from finish();
rollback;
