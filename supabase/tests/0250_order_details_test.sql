-- Step 2 / inc-5a: order_details RLS — visible to anyone who can see the order (admin/manager tenant,
-- owning customer, assigned staff); cross-tenant invisible.
begin;
select plan(8);

select has_table('order_details', 'order_details table exists');
select ok((select relrowsecurity from pg_class where relname = 'order_details'), 'RLS on order_details');

-- seed as superuser
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000a2', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000a3', '11111111-1111-1111-1111-111111111111', 'cust@a',  'Cus', 'customer');
insert into customers(id, tenant_id, user_id, name, status) values
  ('cccccccc-cccc-cccc-cccc-0000000000c1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000a3', 'C1', 'claimed'),
  ('cccccccc-cccc-cccc-cccc-0000000000c2', '11111111-1111-1111-1111-111111111111', null, 'C2', 'shadow');
insert into orders(id, tenant_id, code, customer_id, service, value, assignee_id) values
  ('dddddddd-dddd-dddd-dddd-00000000d001', '11111111-1111-1111-1111-111111111111', 'O1', 'cccccccc-cccc-cccc-cccc-0000000000c1', 'Audit', 10, 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000a2'),
  ('dddddddd-dddd-dddd-dddd-00000000d002', '11111111-1111-1111-1111-111111111111', 'O2', 'cccccccc-cccc-cccc-cccc-0000000000c2', 'Content', 20, null);
insert into order_details(order_id, tenant_id, project, folder, brief, included) values
  ('dddddddd-dddd-dddd-dddd-00000000d001', '11111111-1111-1111-1111-111111111111', 'Acme SEO', 'General', '[{"label":"Goal","value":"rank"}]', '{audit}'),
  ('dddddddd-dddd-dddd-dddd-00000000d002', '11111111-1111-1111-1111-111111111111', 'C2 SEO',   'General', '[]', '{content}');

set local role authenticated;

-- admin: both rows in tenant
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-0000000000a1"}';
select is((select count(*) from order_details)::int, 2, 'admin sees both order_details rows');

-- owning customer: only their order's detail (O1)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-0000000000a3"}';
select is((select count(*) from order_details)::int, 1, 'customer sees only their own order detail');
select is((select order_id from order_details), 'dddddddd-dddd-dddd-dddd-00000000d001'::uuid, 'customer sees specifically O1 (not O2)');

-- assigned staff: only the order they work (O1)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-0000000000a2"}';
select is((select count(*) from order_details)::int, 1, 'assigned staff sees only their order detail');

-- manager: tenant-wide (non-money fields)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-0000000000a1"}';
select is((select count(*) from order_details)::int, 2, 'manager sees tenant order_details');

-- cross-tenant: nothing
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-0000000000a1"}';
select is((select count(*) from order_details)::int, 0, 'cross-tenant admin sees 0 order_details');

reset role;
select * from finish();
rollback;
