-- E0b increment: tickets + ticket_messages RLS (customer support surface).
-- admin sees all tenant tickets; customer sees tickets on their own record; staff sees only
-- assigned tickets; messages inherit parent-ticket visibility; cross-tenant is fully isolated.
begin;
select plan(10);

select has_table('tickets', 'tickets table exists');
select has_table('ticket_messages', 'ticket_messages table exists');
select ok((select relrowsecurity from pg_class where relname = 'tickets'), 'RLS on tickets');
select ok((select relrowsecurity from pg_class where relname = 'ticket_messages'), 'RLS on ticket_messages');

-- seed as superuser
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c@a.com',  'Cust',   'customer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 's1@a.com', 'Staff1', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111111', 's2@a.com', 'Staff2', 'staff');
insert into customers(id, tenant_id, user_id, name, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'C1', 'claimed');

-- T1: customer C's ticket assigned to Staff1; T2: customer C's ticket assigned to Staff2.
insert into tickets(id, tenant_id, code, subject, customer_id, type, assignee_id) values
  ('cc000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'TK-1', 'Login issue',  '00000000-0000-0000-0000-000000000001', 'technical', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'),
  ('cc000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'TK-2', 'Invoice query','00000000-0000-0000-0000-000000000001', 'billing',   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2');

insert into ticket_messages(tenant_id, ticket_id, author_role, author_id, body) values
  ('11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-0000000000a1', 'customer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'I cannot log in'),
  ('11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-0000000000a1', 'staff',    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Looking into it'),
  ('11111111-1111-1111-1111-111111111111', 'cc000000-0000-0000-0000-0000000000a2', 'customer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Where is my invoice?');

set local role authenticated;

-- admin sees all tenant tickets + all messages
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from tickets)::int, 2, 'admin sees all tenant tickets');
select is((select count(*) from ticket_messages)::int, 3, 'admin sees all tenant ticket messages');

-- customer sees both of their own tickets + all their messages
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from tickets)::int, 2, 'customer sees their own tickets');

-- staff1 sees only the ticket assigned to them + only that ticket''s messages
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"}';
select is((select count(*) from tickets)::int, 1, 'staff sees only their assigned ticket');
select is((select count(*) from ticket_messages)::int, 2, 'staff sees only messages on their assigned ticket');

-- cross-tenant admin (tenant B) sees nothing from tenant A
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from tickets)::int, 0, 'cross-tenant admin sees no foreign tickets');

reset role;
select * from finish();
rollback;
