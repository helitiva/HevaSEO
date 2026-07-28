-- Step 2 / inc-5c: order_addons (MONEY) RLS — admin + owning customer see upsells (with price);
-- staff & manager are money-blind (0 rows); cross-tenant invisible.
begin;
select plan(8);

select has_table('order_addons', 'order_addons table exists');
select ok((select relrowsecurity from pg_class where relname = 'order_addons'), 'RLS on order_addons');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3', '11111111-1111-1111-1111-111111111111', 'cust@a',  'Cus', 'customer');
insert into customers(id, tenant_id, user_id, name, status) values
  ('cccccccc-cccc-cccc-cccc-00000000c0c1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3', 'C1', 'claimed');
insert into orders(id, tenant_id, code, customer_id, service, value) values
  ('eeeeeeee-eeee-eeee-eeee-00000000e0e1', '11111111-1111-1111-1111-111111111111', 'O1', 'cccccccc-cccc-cccc-cccc-00000000c0c1', 'Audit', 50);
insert into order_addons(order_id, tenant_id, name, tier, price) values
  ('eeeeeeee-eeee-eeee-eeee-00000000e0e1', '11111111-1111-1111-1111-111111111111', 'Rush delivery', 'pro', 25);

set local role authenticated;

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select is((select count(*) from order_addons)::int, 1, 'admin sees the order addon');
select is((select price from order_addons)::numeric, 25::numeric, 'admin sees the addon price');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3"}';
select is((select count(*) from order_addons)::int, 1, 'owning customer sees their addon');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2"}';
select is((select count(*) from order_addons)::int, 0, 'staff is money-blind to addons (0 rows)');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select is((select count(*) from order_addons)::int, 0, 'manager is money-blind to addons (0 rows)');

set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select is((select count(*) from order_addons)::int, 0, 'cross-tenant admin sees 0 addons');

reset role;
select * from finish();
rollback;
