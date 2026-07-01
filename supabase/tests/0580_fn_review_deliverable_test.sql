-- inc-E28: review_deliverable — admin approves / requests changes on a submitted deliverable.
begin;
select plan(8);

select has_function('review_deliverable', 'review_deliverable() exists');
select ok(not has_function_privilege('anon', 'review_deliverable(uuid,text,text)', 'execute'), 'anon CANNOT review');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff');
insert into customers(id, tenant_id, name, company, email, status) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Acme', 'Acme', 'c@a', 'claimed');
insert into orders(id, tenant_id, customer_id, code, service, value, state, assignee_id) values
  ('00000000-0000-0000-0000-00000000ab01'::uuid, '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'X1', 'Keyword', 60, 'internal_review', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051');
insert into deliverables(id, tenant_id, order_id, submitter_id, version, status, summary) values
  ('dddddddd-0000-0000-0000-00000000de01', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000ab01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 1, 'submitted', 'v1'),
  ('dddddddd-0000-0000-0000-00000000de02', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000ab01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 2, 'submitted', 'v2');

set local role authenticated;

-- non-admin blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a051"}';
select throws_ok($$ select review_deliverable('dddddddd-0000-0000-0000-00000000de01','approve',null) $$, 'NOT_ADMIN', 'staff cannot review');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select throws_ok($$ select review_deliverable('dddddddd-0000-0000-0000-00000000de01','delete',null) $$, 'BAD_ACTION', 'bad action rejected');

-- request changes on v1 (note stored)
select review_deliverable('dddddddd-0000-0000-0000-00000000de01', 'request_changes', 'fix the intro');
select is((select status::text from deliverables where id = 'dddddddd-0000-0000-0000-00000000de01'), 'changes_requested', 'v1 → changes_requested');
select is((select review_note from deliverables where id = 'dddddddd-0000-0000-0000-00000000de01'), 'fix the intro', 'review note stored');
-- re-review the same one → blocked
select throws_ok($$ select review_deliverable('dddddddd-0000-0000-0000-00000000de01','approve',null) $$, 'ALREADY_REVIEWED', 're-review blocked');
-- approve v2
select review_deliverable('dddddddd-0000-0000-0000-00000000de02', 'approve', null);
select is((select status::text from deliverables where id = 'dddddddd-0000-0000-0000-00000000de02'), 'approved', 'v2 → approved');

reset role;
select * from finish();
rollback;
