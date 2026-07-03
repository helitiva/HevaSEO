-- request_order_changes: a delivered order goes back to changes_requested WITH a required note posted as
-- a visible order_message (+ attachments). Empty note → nothing happens.
begin;
select plan(6);

select has_function('request_order_changes', 'request_order_changes() exists');
select ok(not has_function_privilege('anon', 'request_order_changes(uuid,text,jsonb)', 'execute'), 'anon CANNOT request changes');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000c11', '11111111-1111-1111-1111-111111111111', 'c1@a', 'C1', 'customer');
insert into customers(id, tenant_id, name, email, status, user_id) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'One', 'c1@a', 'claimed', 'aaaaaaaa-0000-0000-0000-000000000c11');
-- a delivered order owned by c1
insert into orders(id, tenant_id, code, service, state, priority, source, value, customer_id)
  values ('dddddddd-0000-0000-0000-00000000d001', '11111111-1111-1111-1111-111111111111', 'AD-9', 'Audit', 'delivered', 'med', 'dashboard', 60, 'cccccccc-0000-0000-0000-0000000000c1');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';

-- empty note is rejected (order stays delivered)
select throws_ok($$ select request_order_changes('dddddddd-0000-0000-0000-00000000d001', '   ') $$, 'EMPTY_NOTE', 'empty note is rejected');

-- real note + a media attachment → transition + message
select request_order_changes('dddddddd-0000-0000-0000-00000000d001', 'Please redo section 2',
  '[{"kind":"image","url":"http://x/y.png","name":"y.png"}]'::jsonb);

reset role;
select is((select state::text from orders where id = 'dddddddd-0000-0000-0000-00000000d001'), 'changes_requested', 'order moved to changes_requested');
select is((select body from order_messages where order_id = 'dddddddd-0000-0000-0000-00000000d001'), 'Please redo section 2', 'the revision note is posted as a message');
select is((select jsonb_array_length(attachments) from order_messages where order_id = 'dddddddd-0000-0000-0000-00000000d001'), 1, 'the attachment is stored');

select * from finish();
rollback;
