-- Notifications RLS: only the recipient can see their notifications — personal, even from admin.
begin;
select plan(5);

select has_table('notifications', 'notifications table exists');
select ok((select relrowsecurity from pg_class where relname = 'notifications'), 'RLS on notifications');

-- seed as superuser
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'u1@a.com', 'U1', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'u2@a.com', 'U2', 'staff');
insert into notifications(id, tenant_id, user_id, kind, title) values
  ('11110000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'order_update', 'U1 notification'),
  ('11110000-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'order_update', 'U2 notification');

set local role authenticated;

-- recipient u1 sees only their own notifications
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from notifications)::int, 1, 'u1 sees only their own notifications');

-- recipient u2 sees only their own notifications
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
select is((select count(*) from notifications)::int, 1, 'u2 sees only their own notifications');

-- cross-tenant claim sees nothing
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from notifications)::int, 0, 'cross-tenant claim sees no notifications');

reset role;
select * from finish();
rollback;
