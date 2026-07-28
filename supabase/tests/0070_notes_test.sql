-- Private notes RLS: only the owner can see their notes — private even from admin.
begin;
select plan(7);

select has_table('notes', 'notes table exists');
select has_table('note_attachments', 'note_attachments table exists');
select ok((select relrowsecurity from pg_class where relname = 'notes'), 'RLS on notes');
select ok((select relrowsecurity from pg_class where relname = 'note_attachments'), 'RLS on note_attachments');

-- seed as superuser
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'u1@a.com', 'U1', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'u2@a.com', 'U2', 'staff');
insert into notes(id, tenant_id, owner_id, surface, title) values
  ('11110000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'staff', 'U1 note'),
  ('11110000-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'staff', 'U2 note');

set local role authenticated;

-- owner u1 sees only their own note
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from notes)::int, 1, 'owner sees only their own notes');

-- owner u2 sees only their own note
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
select is((select count(*) from notes)::int, 1, 'a different owner sees only their own notes');

-- admin (not the owner) cannot see private notes of others
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"cccccccc-cccc-cccc-cccc-cccccccccccc"}';
select is((select count(*) from notes)::int, 0, 'admin cannot see private notes of others');

reset role;
select * from finish();
rollback;
