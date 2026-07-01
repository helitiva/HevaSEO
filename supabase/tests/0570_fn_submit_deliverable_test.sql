-- inc-E27: submit_deliverable — only the order's assignee submits; versions increment; status submitted.
begin;
select plan(6);

select has_function('submit_deliverable', 'submit_deliverable() exists');
select ok(not has_function_privilege('anon', 'submit_deliverable(uuid,text,jsonb)', 'execute'), 'anon CANNOT submit');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a052', '11111111-1111-1111-1111-111111111111', 's2@a', 'S2', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'c1@a', 'C1', 'customer');
insert into customers(id, tenant_id, name, company, email, status) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Acme', 'Acme', 'c@a', 'claimed');
insert into orders(id, tenant_id, customer_id, code, service, value, state, assignee_id) values
  ('00000000-0000-0000-0000-00000000ab01'::uuid, '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'X1', 'Keyword', 60, 'in_progress', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051');

set local role authenticated;

-- non-staff blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select throws_ok($$ select submit_deliverable('00000000-0000-0000-0000-00000000ab01','done','[]') $$, 'NOT_STAFF', 'customer cannot submit');

-- a staff who is NOT the assignee is blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a052"}';
select throws_ok($$ select submit_deliverable('00000000-0000-0000-0000-00000000ab01','sneaky','[]') $$, 'NOT_YOUR_ORDER', 'non-assignee staff blocked');

-- the assignee submits → v1, then v2
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a051"}';
select submit_deliverable('00000000-0000-0000-0000-00000000ab01', 'first pass', '[{"kind":"link","url":"https://x/1"}]');
select submit_deliverable('00000000-0000-0000-0000-00000000ab01', 'second pass', '[]');
select is((select max(version) from deliverables where order_id = '00000000-0000-0000-0000-00000000ab01'), 2, 'version incremented to 2');
select is((select count(*) from deliverables where order_id = '00000000-0000-0000-0000-00000000ab01' and status = 'submitted')::int, 2, 'both versions status submitted');

reset role;
select * from finish();
rollback;
