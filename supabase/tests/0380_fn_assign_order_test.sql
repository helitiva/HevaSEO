-- assign_order — admin assigns any order to any staff; a manager may assign within their own pod
-- (unassigned/pod order → pod staff). Others rejected.
begin;
select plan(9);

select has_function('assign_order', 'assign_order() exists');
select ok(not has_function_privilege('anon', 'assign_order(uuid,uuid)', 'execute'), 'anon CANNOT assign');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3', '11111111-1111-1111-1111-111111111111', 'staff2@a', 'St2', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0b1', '11111111-1111-1111-1111-111111111111', 'mgr@a', 'Mgr', 'manager'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer');
-- staff2 is in Mgr's pod; staff is NOT
insert into staff_details(tenant_id, profile_id, manager_id) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0b1');
insert into customers(id, tenant_id, name) values ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Acme');
insert into orders(id, tenant_id, code, customer_id, service, value, state) values
  ('00000000-0000-0000-0000-000000000d01'::uuid, '11111111-1111-1111-1111-111111111111', 'ORD-1', 'cccccccc-0000-0000-0000-0000000000c1', 'Audit', 39, 'confirmed'),
  ('00000000-0000-0000-0000-000000000d02'::uuid, '11111111-1111-1111-1111-111111111111', 'ORD-2', 'cccccccc-0000-0000-0000-0000000000c1', 'Audit', 39, 'new'); -- unassigned

set local role authenticated;

-- a customer (neither admin nor manager) cannot assign
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select throws_ok($$ select assign_order('00000000-0000-0000-0000-000000000d01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2') $$, 'NOT_AUTHORIZED', 'customer cannot assign');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select throws_ok($$ select assign_order('00000000-0000-0000-0000-000000000d01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1') $$, 'NOT_STAFF', 'cannot assign to a non-staff profile');

-- admin assigns confirmed order → assignee set + state advances to assigned
select assign_order('00000000-0000-0000-0000-000000000d01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2');
select is((select assignee_id from orders where id = '00000000-0000-0000-0000-000000000d01'), 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2'::uuid, 'assignee set');
select is((select state::text from orders where id = '00000000-0000-0000-0000-000000000d01'), 'assigned', 'confirmed→assigned on assign');
select assign_order('00000000-0000-0000-0000-000000000d01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3');
select is((select assignee_id from orders where id = '00000000-0000-0000-0000-000000000d01'), 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3'::uuid, 'reassign swaps assignee');

-- manager assigns an UNASSIGNED order to a POD staffer → allowed; a NON-pod staffer is rejected
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0b1"}';
select assign_order('00000000-0000-0000-0000-000000000d02', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3');
select throws_ok($$ select assign_order('00000000-0000-0000-0000-000000000d02', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2') $$, 'NOT_YOUR_POD', 'manager cannot assign to a non-pod staffer');

-- verify as superuser (managers are money-blind and cannot read the base orders table directly)
reset role;
select is((select assignee_id from orders where id = '00000000-0000-0000-0000-000000000d02'), 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a3'::uuid, 'manager assigned the unassigned order to their pod staff');
select * from finish();
rollback;
