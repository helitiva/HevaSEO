-- Lane C inc-C3: upsert_doc + delete_doc — admin-gated authoring (claims-derived tenant/author).
begin;
select plan(10);

select has_function('upsert_doc', 'upsert_doc() exists');
select has_function('delete_doc', 'delete_doc() exists');
select ok(not has_function_privilege('anon', 'delete_doc(uuid)', 'execute'), 'anon CANNOT delete docs');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A'), ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'AdmA', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer');
-- a doc in tenant B, inserted as the test owner (the docs table is SELECT-only for authenticated)
insert into docs(id, tenant_id, title, audiences) values
  ('dddddddd-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'B-doc', array['customer']);

set local role authenticated;

-- non-admin cannot author
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select throws_ok($$ select upsert_doc('X', '{}'::jsonb, array['customer'], array[]::text[], false) $$, 'NOT_ADMIN', 'customer cannot author a doc');

-- admin creates a doc (p_id omitted → insert) → tenant + author stamped from claims
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select lives_ok($$ select upsert_doc('Welcome', '{"summary":"hi"}'::jsonb, array['customer'], array[]::text[], true) $$, 'admin creates a doc');
select is((select count(*) from docs where tenant_id = '11111111-1111-1111-1111-111111111111' and title = 'Welcome' and author_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1')::int, 1, 'doc stamped with tenant + author from claims');

-- bad input rejected
select throws_ok($$ select upsert_doc('  ', '{}'::jsonb, array['customer'], array[]::text[], false) $$, 'INVALID_TITLE', 'empty title rejected');
select throws_ok($$ select upsert_doc('X', '{}'::jsonb, array['everyone'], array[]::text[], false) $$, 'INVALID_AUDIENCE', 'non-role audience rejected');

-- admin cannot edit another tenant's doc (tenant-scoped; the B-doc was seeded in setup above)
select throws_ok($$ select upsert_doc('hacked', '{}'::jsonb, array['customer'], array[]::text[], false, 'dddddddd-0000-0000-0000-0000000000b1') $$, 'DOC_NOT_FOUND', 'cannot edit another tenant''s doc');

-- delete own tenant doc
select lives_ok($$ select delete_doc((select id from docs where tenant_id = '11111111-1111-1111-1111-111111111111' and title = 'Welcome')) $$, 'admin deletes own doc');

reset role;
select * from finish();
rollback;
