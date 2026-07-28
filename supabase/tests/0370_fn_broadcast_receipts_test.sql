-- Lane C inc-C6: mark_broadcast_read / mark_broadcast_click — claims-derived, recipient-only, idempotent.
begin;
select plan(7);

select has_function('mark_broadcast_read', 'mark_broadcast_read() exists');
select has_function('mark_broadcast_click', 'mark_broadcast_click() exists');
select ok(not has_function_privilege('anon', 'mark_broadcast_read(uuid)', 'execute'), 'anon CANNOT mark read');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff');
insert into broadcasts(id, tenant_id, title, audiences, status) values
  ('bbbbbbbb-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'For customers', array['customer'], 'live');

set local role authenticated;

-- customer marks read → one event; idempotent on re-mark
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select mark_broadcast_read('bbbbbbbb-0000-0000-0000-0000000000c1');
select mark_broadcast_read('bbbbbbbb-0000-0000-0000-0000000000c1');
select is((select count(*) from broadcast_events where broadcast_id = 'bbbbbbbb-0000-0000-0000-0000000000c1' and kind = 'read')::int, 1, 'read is idempotent (one event per user)');

-- click implies a read + a click (still one of each)
select mark_broadcast_click('bbbbbbbb-0000-0000-0000-0000000000c1');
select is((select count(*) from broadcast_events where broadcast_id = 'bbbbbbbb-0000-0000-0000-0000000000c1' and kind = 'click')::int, 1, 'click recorded once');

-- CRITICAL: a non-recipient (wrong audience) cannot mark read
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2"}';
select throws_ok($$ select mark_broadcast_read('bbbbbbbb-0000-0000-0000-0000000000c1') $$, 'NOT_A_RECIPIENT', 'staff (not in audiences) cannot mark a customer broadcast read');

-- admin sees all events (analytics); customer sees own
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select is((select count(*) from broadcast_events where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1')::int, 2, 'customer sees own 2 events (read+click)');

reset role;
select * from finish();
rollback;
