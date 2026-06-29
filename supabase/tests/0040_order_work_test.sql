-- E0b increment 4: tasks + deliverables RLS (the delivery loop).
-- Staff see only their own work; customers see only APPROVED deliverables for their orders.
begin;
select plan(8);

select has_table('tasks', 'tasks table exists');
select has_table('deliverables', 'deliverables table exists');
select ok((select relrowsecurity from pg_class where relname = 'tasks'), 'RLS on tasks');
select ok((select relrowsecurity from pg_class where relname = 'deliverables'), 'RLS on deliverables');

-- seed as superuser
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 's1@a.com', 'Staff1', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111111', 's2@a.com', 'Staff2', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c@a.com',  'Cust',   'customer');
insert into customers(id, tenant_id, user_id, name, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'C1', 'claimed');
insert into orders(id, tenant_id, code, customer_id, service, value) values
  ('0d000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'O-1', '00000000-0000-0000-0000-000000000001', 'Keyword', 100);
insert into tasks(tenant_id, order_id, assignee_id, title) values
  ('11111111-1111-1111-1111-111111111111', '0d000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Task for S1'),
  ('11111111-1111-1111-1111-111111111111', '0d000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Task for S2');
insert into deliverables(tenant_id, order_id, submitter_id, version, status) values
  ('11111111-1111-1111-1111-111111111111', '0d000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 1, 'submitted'),
  ('11111111-1111-1111-1111-111111111111', '0d000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 2, 'approved');

set local role authenticated;

-- staff1 sees only their assigned task
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"}';
select is((select count(*) from tasks)::int, 1, 'staff sees only their own assigned task');
select is((select count(*) from deliverables)::int, 2, 'staff sees their own submitted deliverables');

-- admin sees all tenant tasks
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from tasks)::int, 2, 'admin sees all tenant tasks');

-- customer sees only the APPROVED deliverable for their order
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from deliverables)::int, 1, 'customer sees only approved deliverable');

reset role;
select * from finish();
rollback;
