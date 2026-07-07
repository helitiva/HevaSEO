-- Manager↔staff private thread: staffer + pod manager both post/read; outside managers are locked out.
begin;
select plan(5);

select ok(exists(select 1 from pg_policies where tablename = 'staff_manager_messages' and policyname = 'smm_manager_pod'),
  'manager pod policy exists');

insert into tenants(id, name) values ('55555555-5555-5555-5555-555555555555', 'T5');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', '55555555-5555-5555-5555-555555555555', 'm1@t5', 'Mgr1', 'manager'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', '55555555-5555-5555-5555-555555555555', 'm2@t5', 'Mgr2', 'manager'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', '55555555-5555-5555-5555-555555555555', 's1@t5', 'Staff1', 'staff');
insert into staff_details(tenant_id, profile_id, manager_id) values
  ('55555555-5555-5555-5555-555555555555', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000a1');

set local role authenticated;

-- the pod manager posts to the staffer's thread
set local request.jwt.claims = '{"tenant_id":"55555555-5555-5555-5555-555555555555","app_role":"manager","profile_id":"aaaaaaaa-0000-0000-0000-0000000000a1"}';
select post_staff_manager_message('bbbbbbbb-0000-0000-0000-0000000000b1', 'hi from your manager');

-- the staffer replies (p_staff ignored → own thread)
set local request.jwt.claims = '{"tenant_id":"55555555-5555-5555-5555-555555555555","app_role":"staff","profile_id":"bbbbbbbb-0000-0000-0000-0000000000b1"}';
select post_staff_manager_message(null, 'got it, thanks');
select is((select count(*)::int from staff_manager_messages), 2, 'staffer sees both messages in their own thread');

-- the pod manager reads the staffer's thread
set local request.jwt.claims = '{"tenant_id":"55555555-5555-5555-5555-555555555555","app_role":"manager","profile_id":"aaaaaaaa-0000-0000-0000-0000000000a1"}';
select is((select count(*)::int from staff_manager_messages where staff_id = 'bbbbbbbb-0000-0000-0000-0000000000b1'), 2, 'pod manager reads the thread');

-- a manager who does NOT manage this staffer sees nothing and cannot post
set local request.jwt.claims = '{"tenant_id":"55555555-5555-5555-5555-555555555555","app_role":"manager","profile_id":"aaaaaaaa-0000-0000-0000-0000000000a2"}';
select is((select count(*)::int from staff_manager_messages), 0, 'an outside manager sees no messages');
select throws_ok(
  $$ select post_staff_manager_message('bbbbbbbb-0000-0000-0000-0000000000b1', 'not my staffer') $$,
  null, 'NOT_YOUR_POD', 'an outside manager cannot post to the thread');

reset role;
select * from finish();
rollback;
