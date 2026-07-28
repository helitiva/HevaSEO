-- SECURITY regression guard for 20260701410000_profiles_rls_scope.
-- Internal roles (admin/manager/staff) read the tenant roster; external roles (customer/affiliate) get
-- their own row only, plus — for a customer — profiles connected to their own orders (assigned staffer +
-- message authors). Fails loudly if a customer can once again enumerate the whole tenant.
begin;
select plan(7);

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'adm@a.com', 'Adm',    'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'mgr@a.com', 'Mgr',    'manager'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', 'st1@a.com', 'Staff1', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '11111111-1111-1111-1111-111111111111', 'st2@a.com', 'Staff2', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '11111111-1111-1111-1111-111111111111', 'cus@a.com', 'Cust',   'customer'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', '11111111-1111-1111-1111-111111111111', 'aff@a.com', 'Aff',    'affiliate');
insert into customers(id, tenant_id, user_id, name, status) values
  ('00000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'C1', 'claimed');
-- the customer's order is assigned to Staff1 (→ connected); Staff2 is unrelated
insert into orders(id, tenant_id, code, customer_id, service, value, assignee_id) values
  ('0d000000-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'O-1', '00000000-0000-0000-0000-0000000000c1', 'Keyword', 100, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3');

set local role authenticated;

-- CUSTOMER: own row + connected staffer only (NOT the whole tenant)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5"}';
select is((select count(*) from profiles)::int, 2, 'customer sees only own + connected profile');
select ok(
  (select bool_and(id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3')) from profiles),
  'customer sees exactly own row + the staffer assigned to their order');
select is((select count(*) from profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4')::int, 0,
  'CRITICAL: customer CANNOT read an unrelated staff profile');
select is((select count(*) from profiles where role = 'admin')::int, 0,
  'CRITICAL: customer CANNOT enumerate admins');

-- AFFILIATE: own row only
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6"}';
select is((select count(*) from profiles)::int, 1, 'affiliate sees only their own profile');

-- STAFF (internal): same-tenant roster read
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3"}';
select is((select count(*) from profiles)::int, 6, 'internal staff reads the tenant roster');

-- ADMIN: all
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"}';
select is((select count(*) from profiles)::int, 6, 'admin reads all tenant profiles');

reset role;
select * from finish();
rollback;
