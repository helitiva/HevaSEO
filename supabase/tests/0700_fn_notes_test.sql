-- Notes: owner-scoped upsert/delete via SECURITY DEFINER fns; a user manages only their own notes.
begin;
select plan(8);

select has_function('upsert_note', 'upsert_note() exists');
select ok(not has_function_privilege('anon', 'upsert_note(uuid,text,text,jsonb,text)', 'execute'), 'anon CANNOT upsert a note');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-000000000a11', '11111111-1111-1111-1111-111111111111', 'n1@a', 'N1', 'customer'),
  ('aaaaaaaa-0000-0000-0000-000000000a22', '11111111-1111-1111-1111-111111111111', 'n2@a', 'N2', 'customer');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000a11"}';

-- create
select upsert_note('dddddddd-0000-0000-0000-0000000000d1', 'customer', 'T1', '{"html":"<p>hi</p>","category":"Ideas","pinned":true}'::jsonb, 'amber');
select is((select count(*)::int from notes where owner_id = 'aaaaaaaa-0000-0000-0000-000000000a11'), 1, 'owner created a note');
select is((select title from notes where id = 'dddddddd-0000-0000-0000-0000000000d1'), 'T1', 'title stored');

-- update own
select upsert_note('dddddddd-0000-0000-0000-0000000000d1', 'customer', 'T1b', '{"html":"<p>hi2</p>"}'::jsonb, 'sky');
select is((select title from notes where id = 'dddddddd-0000-0000-0000-0000000000d1'), 'T1b', 'owner updated the note');

-- another user cannot hijack the note id
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000a22"}';
select throws_ok($$ select upsert_note('dddddddd-0000-0000-0000-0000000000d1', 'customer', 'hack', '{}'::jsonb, 'rose') $$, 'NOT_OWNER', 'cannot update another owner''s note');
select delete_note('dddddddd-0000-0000-0000-0000000000d1');  -- no-op for a non-owner

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000a11"}';
select is((select count(*)::int from notes where id = 'dddddddd-0000-0000-0000-0000000000d1'), 1, 'another user cannot delete your note');
select delete_note('dddddddd-0000-0000-0000-0000000000d1');
select is((select count(*)::int from notes where id = 'dddddddd-0000-0000-0000-0000000000d1'), 0, 'owner deletes own note');

reset role;
select * from finish();
rollback;
