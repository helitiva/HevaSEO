-- inc-E29: order_messages — participant-gated post + role-scoped read (customer sees non-internal only).
begin;
select plan(8);

select has_table('order_messages', 'order_messages table exists');
select ok(not has_function_privilege('anon', 'post_order_message(uuid,text,boolean)', 'execute'), 'anon CANNOT post');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a052', '11111111-1111-1111-1111-111111111111', 's2@a', 'S2', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'c1@a', 'C1', 'customer');
insert into customers(id, tenant_id, user_id, name, company, email, status) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', 'Acme', 'Acme', 'c@a', 'claimed');
insert into orders(id, tenant_id, customer_id, code, service, value, state, assignee_id) values
  ('00000000-0000-0000-0000-00000000ab01'::uuid, '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'X1', 'Keyword', 60, 'in_progress', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051');

set local role authenticated;

-- non-participant staff blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a052"}';
select throws_ok($$ select post_order_message('00000000-0000-0000-0000-00000000ab01','hi',true) $$, 'NOT_PARTICIPANT', 'non-assignee staff blocked');

-- admin posts an internal note + a customer-facing message
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select post_order_message('00000000-0000-0000-0000-00000000ab01', 'internal note', true);
select post_order_message('00000000-0000-0000-0000-00000000ab01', 'hello customer', false);
select throws_ok($$ select post_order_message('00000000-0000-0000-0000-00000000ab01','',false) $$, 'EMPTY_MESSAGE', 'empty body rejected');

-- assigned staff posts + sees ALL (internal + facing)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a051"}';
select post_order_message('00000000-0000-0000-0000-00000000ab01', 'staff update', false);
select is((select count(*) from order_messages)::int, 3, 'assignee staff sees all 3 messages');

-- customer posts (forced non-internal) + sees NON-internal only (2 facing + own = 3, hides the internal note)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select post_order_message('00000000-0000-0000-0000-00000000ab01', 'thanks!', true);   -- requests internal, forced false
select is((select internal from order_messages where body = 'thanks!'), false, 'customer message forced non-internal');
select is((select count(*) from order_messages)::int, 3, 'customer sees only non-internal (internal note hidden)');
select is((select count(*) from order_messages where internal)::int, 0, 'customer cannot see the internal note');

reset role;
select * from finish();
rollback;
