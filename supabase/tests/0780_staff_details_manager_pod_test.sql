-- A manager reads ONLY their own pod's staff_details (manager_id = them) — not other pods, not money.
begin;
select plan(3);
select ok(exists(select 1 from pg_policies where tablename = 'staff_details' and policyname = 'staff_details_manager_pod'),
  'manager pod policy exists on staff_details');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'm1@a', 'Mgr1', 'manager'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'm2@a', 'Mgr2', 'manager'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 's1@a', 'Staff1', 'staff'),
  ('bbbbbbbb-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 's2@a', 'Staff2', 'staff');
insert into staff_details(tenant_id, profile_id, manager_id) values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000a1'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000a2');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-0000-0000-0000-0000000000a1"}';

select is((select count(*)::int from staff_details), 1, 'manager sees exactly one row — their own pod');
select is((select profile_id from staff_details), 'bbbbbbbb-0000-0000-0000-0000000000b1'::uuid, 'and it is their own pod staffer (not the other pod)');

reset role;
select * from finish();
rollback;
