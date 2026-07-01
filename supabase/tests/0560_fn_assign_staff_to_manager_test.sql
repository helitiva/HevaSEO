-- inc-E25: assign_staff_to_manager — admin sets/clears staff_details.manager_id (pod link).
begin;
select plan(7);

select has_function('assign_staff_to_manager', 'assign_staff_to_manager() exists');
select ok(not has_function_privilege('anon', 'assign_staff_to_manager(uuid,uuid)', 'execute'), 'anon CANNOT assign pod');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a031', '11111111-1111-1111-1111-111111111111', 'mgr@a',  'Mgr', 'manager');
insert into staff_details(tenant_id, profile_id, skills, capacity) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '{seo}', 5);

set local role authenticated;

-- non-admin blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a051"}';
select throws_ok($$ select assign_staff_to_manager('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051','aaaaaaaa-aaaa-aaaa-aaaa-00000000a031') $$, 'NOT_ADMIN', 'staff cannot assign pod');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
-- guards
select throws_ok($$ select assign_staff_to_manager('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1','aaaaaaaa-aaaa-aaaa-aaaa-00000000a031') $$, 'NOT_STAFF', 'assigning a non-staff rejected');
select throws_ok($$ select assign_staff_to_manager('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051','aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1') $$, 'NOT_MANAGER', 'assigning to a non-manager rejected');

-- assign, then unassign (null)
select assign_staff_to_manager('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051','aaaaaaaa-aaaa-aaaa-aaaa-00000000a031');
select is((select manager_id from staff_details where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051'), 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a031'::uuid, 'pod assigned');
select assign_staff_to_manager('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', null);
select ok((select manager_id is null from staff_details where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051'), 'pod cleared (unassign)');

reset role;
select * from finish();
rollback;
