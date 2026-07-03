-- A customer replying to a RESOLVED ticket reopens it (post_ticket_message: resolved → open).
begin;
select plan(3);

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-000000000c11', '11111111-1111-1111-1111-111111111111', 'c1@a', 'C1', 'customer');
insert into customers(id, tenant_id, name, email, status, user_id) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'One', 'c1@a', 'claimed', 'aaaaaaaa-0000-0000-0000-000000000c11');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';

select create_ticket('Need help', 'technical', 'Please look.', 'med');
select set_ticket_status((select id from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'resolved');
select is((select status::text from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'resolved', 'ticket is resolved');

select post_ticket_message((select id from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'Actually still broken');
select is((select status::text from tickets where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'open', 'a customer reply reopens a resolved ticket');
select is((select count(*)::int from ticket_messages tm join tickets t on t.id = tm.ticket_id where t.customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 2, 'both messages recorded');

reset role;
select * from finish();
rollback;
