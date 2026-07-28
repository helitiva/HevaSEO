-- A manager assigning a fresh ('new') order advances it to 'assigned' (so it lands on the staff board).
begin;
select plan(2);

insert into tenants(id, name) values ('44444444-4444-4444-4444-444444444444', 'T4');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', '44444444-4444-4444-4444-444444444444', 'mgr@t4',   'Mgr',   'manager'),
  ('bbbbbbbb-0000-0000-0000-0000000000f2', '44444444-4444-4444-4444-444444444444', 'staff@t4', 'Staff', 'staff');
insert into staff_details(tenant_id, profile_id, manager_id) values
  ('44444444-4444-4444-4444-444444444444', 'bbbbbbbb-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-0000000000f1');
insert into customers(id, tenant_id, name) values
  ('cccccccc-0000-0000-0000-0000000000f3', '44444444-4444-4444-4444-444444444444', 'Acme4');
insert into orders(id, tenant_id, code, customer_id, service, value, state) values
  ('dddddddd-0000-0000-0000-0000000000f4', '44444444-4444-4444-4444-444444444444', 'NEW-1', 'cccccccc-0000-0000-0000-0000000000f3', 'Audit', 100, 'new');

-- as the pod manager
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"44444444-4444-4444-4444-444444444444","app_role":"manager","profile_id":"aaaaaaaa-0000-0000-0000-0000000000f1"}';
select assign_order('dddddddd-0000-0000-0000-0000000000f4', 'bbbbbbbb-0000-0000-0000-0000000000f2');

reset role;
select is((select state::text from orders where id = 'dddddddd-0000-0000-0000-0000000000f4'), 'assigned',
  'a new order becomes assigned when a manager assigns it');
select is((select assignee_id from orders where id = 'dddddddd-0000-0000-0000-0000000000f4'), 'bbbbbbbb-0000-0000-0000-0000000000f2'::uuid,
  'and the assignee is the pod staffer');

select * from finish();
rollback;
