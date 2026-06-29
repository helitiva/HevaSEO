-- Broadcasts RLS: admin sees all; recipients see only broadcasts whose audiences include their role;
-- events are admin-visible (analytics) or own-only.
begin;
select plan(10);

select has_table('broadcasts', 'broadcasts table exists');
select has_table('broadcast_events', 'broadcast_events table exists');
select ok((select relrowsecurity from pg_class where relname = 'broadcasts'), 'RLS on broadcasts');
select ok((select relrowsecurity from pg_class where relname = 'broadcast_events'), 'RLS on broadcast_events');

-- seed as superuser
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');

insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'cust@a.com', 'Cust', 'customer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'staff@a.com', 'Staff', 'staff');

-- one customer-only broadcast, one staff+manager broadcast
insert into broadcasts(id, tenant_id, title, audiences) values
  ('b1110000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'For customers', '{customer}'),
  ('b1110000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'For staff+manager', '{staff,manager}');

-- events: one for the customer, one for the staff user
insert into broadcast_events(tenant_id, broadcast_id, user_id, kind) values
  ('11111111-1111-1111-1111-111111111111', 'b1110000-0000-0000-0000-0000000000c1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sent'),
  ('11111111-1111-1111-1111-111111111111', 'b1110000-0000-0000-0000-0000000000a2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'read');

set local role authenticated;

-- admin sees all broadcasts in tenant A
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"cccccccc-cccc-cccc-cccc-cccccccccccc"}';
select is((select count(*) from broadcasts)::int, 2, 'admin sees all broadcasts');

-- customer sees only broadcasts whose audiences include 'customer'
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from broadcasts)::int, 1, 'customer sees only customer-audience broadcasts');

-- staff sees only broadcasts whose audiences include 'staff'
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
select is((select count(*) from broadcasts)::int, 1, 'staff sees only staff-audience broadcasts');

-- admin sees all events (analytics)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"cccccccc-cccc-cccc-cccc-cccccccccccc"}';
select is((select count(*) from broadcast_events)::int, 2, 'admin sees all events');

-- a specific user sees only their own events
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from broadcast_events)::int, 1, 'a user sees only their own events');

-- cross-tenant admin (tenant B) sees no broadcasts from tenant A
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin","profile_id":"dddddddd-dddd-dddd-dddd-dddddddddddd"}';
select is((select count(*) from broadcasts)::int, 0, 'cross-tenant admin sees 0 broadcasts');

reset role;
select * from finish();
rollback;
