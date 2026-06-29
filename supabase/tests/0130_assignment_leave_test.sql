-- assignment_rules RLS: admin-only — non-admins see 0 rows.
-- leave_requests RLS: admin sees all tenant requests; staff see only their own.
begin;
select plan(9);

-- structure
select has_table('assignment_rules', 'assignment_rules table exists');
select has_table('leave_requests', 'leave_requests table exists');
select ok((select relrowsecurity from pg_class where relname = 'assignment_rules'), 'RLS on assignment_rules');
select ok((select relrowsecurity from pg_class where relname = 'leave_requests'), 'RLS on leave_requests');

-- seed as superuser
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000a1', '11111111-1111-1111-1111-111111111111', 's1@a.com', 'S1', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000a2', '11111111-1111-1111-1111-111111111111', 's2@a.com', 'S2', 'staff');

-- seed assignment rules in tenant A (2 total)
insert into assignment_rules(id, tenant_id, service, pkg, mode, target_staff_id) values
  ('eeee0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'seo', 'Starter', 'auto', null),
  ('eeee0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'content', 'Pro', 'pin', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000a1');

-- seed leave requests in tenant A: one for S1, one for S2
insert into leave_requests(id, tenant_id, staff_id, from_date, to_date, reason) values
  ('ffff0000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000a1', '2026-07-01', '2026-07-05', 'vacation'),
  ('ffff0000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000a2', '2026-07-10', '2026-07-12', 'personal');

set local role authenticated;

-- admin sees ALL tenant rules
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from assignment_rules)::int, 2, 'admin sees all assignment rules');

-- staff sees 0 rules (admin-only table)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-0000000000a1"}';
select is((select count(*) from assignment_rules)::int, 0, 'staff sees 0 assignment rules');

-- admin sees ALL tenant leave requests
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from leave_requests)::int, 2, 'admin sees all leave requests');

-- S1 sees only their own leave request
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-0000000000a1"}';
select is((select count(*) from leave_requests)::int, 1, 'S1 sees only own leave request');

-- cross-tenant admin sees no rules
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from assignment_rules)::int, 0, 'cross-tenant admin sees 0 rules');

reset role;
select * from finish();
rollback;
