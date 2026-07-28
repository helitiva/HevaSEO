-- E0b increment 3: orders structure + workflow transitions + row-level RLS.
-- Staff/manager visibility is intentionally 0 here — they read via money-stripped
-- views (ADR K9), built at the gated money increment. This keeps `value` from leaking.
begin;
select plan(9);

select has_table('orders', 'orders table exists');
select has_table('allowed_transitions', 'allowed_transitions table exists');
select has_column('orders', 'state', 'orders.state exists');
select ok(
  (select relrowsecurity from pg_class where relname = 'orders'),
  'RLS is enabled on orders'
);
select cmp_ok(
  (select count(*) from allowed_transitions)::int, '>', 0,
  'workflow transitions are seeded'
);

-- seed as superuser (bypasses RLS)
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c@a.com', 'Cust A', 'customer');
insert into customers(id, tenant_id, user_id, name, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'C1', 'claimed'),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', null, 'C2', 'shadow');
insert into orders(tenant_id, code, customer_id, service, value) values
  ('11111111-1111-1111-1111-111111111111', 'O-1', '00000000-0000-0000-0000-000000000001', 'Keyword', 100),
  ('11111111-1111-1111-1111-111111111111', 'O-2', '00000000-0000-0000-0000-000000000002', 'Content', 200);

set local role authenticated;

-- admin sees all tenant orders
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from orders)::int, 2, 'admin sees all tenant orders');

-- customer sees only their own orders
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from orders)::int, 1, 'customer sees only their own orders');

-- staff sees 0 (no base-table policy; money-stripped view is gated)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from orders)::int, 0, 'staff sees 0 orders (money-stripped view gated)');

-- cross-tenant admin sees nothing
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from orders)::int, 0, 'cross-tenant admin sees 0 orders');

reset role;
select * from finish();
rollback;
