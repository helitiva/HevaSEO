-- E0b money increment 4: orders_mgr money-stripped view (ADR K9 / Finding 1).
-- Proves: the view has NO value column, and money-blind roles read orders through it
-- (manager: tenant; staff: assigned only). admin/customer keep using base orders.
begin;
select plan(6);

select has_view('orders_mgr', 'orders_mgr view exists');
select hasnt_column('orders_mgr', 'value', 'orders_mgr omits value (money-stripped, column-level)');

-- seed as superuser
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c@a.com',  'Cust',   'customer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 's1@a.com', 'Staff1', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111111', 's2@a.com', 'Staff2', 'staff');
insert into customers(id, tenant_id, user_id, name, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'C1', 'claimed');
insert into orders(id, tenant_id, code, customer_id, service, value, assignee_id) values
  ('0d000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'O-1', '00000000-0000-0000-0000-000000000001', 'Keyword', 100, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'),
  ('0d000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'O-2', '00000000-0000-0000-0000-000000000001', 'Content', 200, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2');

set local role authenticated;

-- manager reads tenant orders via the money-stripped view (no value exposed)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager"}';
select is((select count(*) from orders_mgr)::int, 2, 'manager sees tenant orders via orders_mgr');

-- staff sees only the orders assigned to them via the view
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"}';
select is((select count(*) from orders_mgr)::int, 1, 'staff sees only their assigned orders via orders_mgr');

-- customer does NOT use this view (they read base orders) → 0 here
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from orders_mgr)::int, 0, 'customer sees 0 via orders_mgr (uses base orders instead)');

-- cross-tenant manager sees nothing of tenant A
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"manager"}';
select is((select count(*) from orders_mgr)::int, 0, 'cross-tenant manager sees 0 via orders_mgr');

reset role;
select * from finish();
rollback;
