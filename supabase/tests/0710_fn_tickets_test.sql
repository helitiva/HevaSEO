-- Tickets + chat: a customer opens/replies to their own ticket; non-participants are blocked; only a
-- customer may open one. Participant-gated SECURITY DEFINER fns.
begin;
select plan(9);

select has_function('create_ticket', 'create_ticket() exists');
select ok(not has_function_privilege('anon', 'create_ticket(text,ticket_type,text,order_priority)', 'execute'), 'anon CANNOT open a ticket');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-000000000c11', '11111111-1111-1111-1111-111111111111', 'c1@a', 'C1', 'customer'),
  ('aaaaaaaa-0000-0000-0000-000000000c22', '11111111-1111-1111-1111-111111111111', 'c2@a', 'C2', 'customer'),
  ('aaaaaaaa-0000-0000-0000-000000000f11', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff');
insert into customers(id, tenant_id, name, company, email, status, user_id) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'One', 'One', 'c1@a', 'claimed', 'aaaaaaaa-0000-0000-0000-000000000c11'),
  ('cccccccc-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 'Two', 'Two', 'c2@a', 'claimed', 'aaaaaaaa-0000-0000-0000-000000000c22');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';

select create_ticket('Links not indexed', 'technical', 'Please take a look.', 'high');
select is((select count(*)::int from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 1, 'customer opened a ticket');
select is((select count(*)::int from ticket_messages tm join tickets t on t.id = tm.ticket_id where t.customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 1, 'the opening message was recorded');
select is((select priority::text from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'high', 'the chosen priority is persisted');

-- owner replies
select post_ticket_message((select id from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'Any update?');
select is((select count(*)::int from ticket_messages tm join tickets t on t.id = tm.ticket_id where t.customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 2, 'owner reply recorded');

-- a different customer cannot post on this ticket
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c22"}';
select throws_ok($$ select post_ticket_message((select id from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'hi') $$, 'NOT_PARTICIPANT', 'non-participant cannot post');

-- a staffer cannot open a customer ticket
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-0000-0000-0000-000000000f11"}';
select throws_ok($$ select create_ticket('x', 'technical', 'y') $$, 'NOT_CUSTOMER', 'non-customer cannot open a ticket');

-- owner closes their ticket
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';
select set_ticket_status((select id from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'closed');
select is((select status::text from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'closed', 'owner closed the ticket');

reset role;
select * from finish();
rollback;
