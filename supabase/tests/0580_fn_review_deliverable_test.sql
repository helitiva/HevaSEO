-- review_deliverable — admin (any) or the pod-manager of the order's assignee approves / requests
-- changes on a submitted deliverable. Others rejected; manager only within their pod.
begin;
select plan(9);

select has_function('review_deliverable', 'review_deliverable() exists');
select ok(not has_function_privilege('anon', 'review_deliverable(uuid,text,text)', 'execute'), 'anon CANNOT review');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0b1', '11111111-1111-1111-1111-111111111111', 'mgr@a', 'Mgr', 'manager'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0b2', '11111111-1111-1111-1111-111111111111', 'mgr2@a', 'Mg2', 'manager');
-- S1 is in Mgr's pod (not Mgr2's)
insert into staff_details(tenant_id, profile_id, manager_id) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0b1');
insert into customers(id, tenant_id, name, company, email, status) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Acme', 'Acme', 'c@a', 'claimed');
insert into orders(id, tenant_id, customer_id, code, service, value, state, assignee_id) values
  ('00000000-0000-0000-0000-00000000ab01'::uuid, '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'X1', 'Keyword', 60, 'internal_review', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051');
insert into deliverables(id, tenant_id, order_id, submitter_id, version, status, summary) values
  ('dddddddd-0000-0000-0000-00000000de01', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000ab01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 1, 'submitted', 'v1'),
  ('dddddddd-0000-0000-0000-00000000de02', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000ab01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 2, 'submitted', 'v2'),
  ('dddddddd-0000-0000-0000-00000000de03', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000ab01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 3, 'submitted', 'v3'),
  ('dddddddd-0000-0000-0000-00000000de04', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000ab01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 4, 'submitted', 'v4');

set local role authenticated;

-- staff (neither admin nor manager) blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a051"}';
select throws_ok($$ select review_deliverable('dddddddd-0000-0000-0000-00000000de01','approve',null) $$, 'NOT_AUTHORIZED', 'staff cannot review');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select throws_ok($$ select review_deliverable('dddddddd-0000-0000-0000-00000000de01','delete',null) $$, 'BAD_ACTION', 'bad action rejected');

-- admin requests changes on v1 (note stored)
select review_deliverable('dddddddd-0000-0000-0000-00000000de01', 'request_changes', 'fix the intro');
select is((select status::text from deliverables where id = 'dddddddd-0000-0000-0000-00000000de01'), 'changes_requested', 'v1 → changes_requested');
select throws_ok($$ select review_deliverable('dddddddd-0000-0000-0000-00000000de01','approve',null) $$, 'ALREADY_REVIEWED', 're-review blocked');
select review_deliverable('dddddddd-0000-0000-0000-00000000de02', 'approve', null);
select is((select status::text from deliverables where id = 'dddddddd-0000-0000-0000-00000000de02'), 'approved', 'admin v2 → approved');

-- the POD manager can approve their pod's deliverable
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0b1"}';
select review_deliverable('dddddddd-0000-0000-0000-00000000de03', 'approve', null);
select is((select status::text from deliverables where id = 'dddddddd-0000-0000-0000-00000000de03'), 'approved', 'pod manager approves pod deliverable');

-- a non-pod manager is rejected
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0b2"}';
select throws_ok($$ select review_deliverable('dddddddd-0000-0000-0000-00000000de04','approve',null) $$, 'NOT_YOUR_POD', 'non-pod manager cannot review');

reset role;
select * from finish();
rollback;
