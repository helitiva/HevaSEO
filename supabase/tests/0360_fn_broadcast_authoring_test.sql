-- Lane C inc-C5: upsert_broadcast / set_broadcast_status / delete_broadcast — admin-gated authoring.
begin;
select plan(10);

select has_function('upsert_broadcast', 'upsert_broadcast() exists');
select has_function('set_broadcast_status', 'set_broadcast_status() exists');
select has_function('delete_broadcast', 'delete_broadcast() exists');
select ok(not has_function_privilege('anon', 'delete_broadcast(uuid)', 'execute'), 'anon CANNOT delete broadcasts');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A'), ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'AdmA', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer');
-- a broadcast in tenant B (seeded as owner; broadcasts is SELECT-only for authenticated)
insert into broadcasts(id, tenant_id, title, audiences, status) values
  ('bbbbbbbb-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'B-cast', array['customer'], 'live');

set local role authenticated;

-- non-admin cannot author
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select throws_ok($$ select upsert_broadcast('X','b',array['customer'],'notice',true,false,false,'live') $$, 'NOT_ADMIN', 'customer cannot author a broadcast');

-- admin creates (p_id omitted → insert), tenant + author stamped from claims
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select lives_ok($$ select upsert_broadcast('Launch','We shipped it',array['customer','staff'],'congrats',true,true,false,'live') $$, 'admin creates a broadcast');
select is((select count(*) from broadcasts where tenant_id = '11111111-1111-1111-1111-111111111111' and title = 'Launch' and created_by_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1' and status = 'live')::int, 1, 'broadcast stamped with tenant + author');

-- bad audience rejected
select throws_ok($$ select upsert_broadcast('X','b',array['everyone'],'notice',true,false,false,'live') $$, 'INVALID_AUDIENCE', 'non-role audience rejected');

-- recall sets status; cannot touch another tenant's broadcast
select set_broadcast_status((select id from broadcasts where title = 'Launch'), 'recalled');
select is((select status::text from broadcasts where title = 'Launch'), 'recalled', 'recall sets status=recalled');
select throws_ok($$ select delete_broadcast('bbbbbbbb-0000-0000-0000-0000000000b1') $$, 'BROADCAST_NOT_FOUND', 'cannot delete another tenant''s broadcast');

reset role;
select * from finish();
rollback;
