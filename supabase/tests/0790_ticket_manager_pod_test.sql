-- A manager reads their tenant's tickets + threads and can act on them; a manager in another tenant can't.
begin;
select plan(5);

select ok(exists(select 1 from pg_policies where tablename = 'tickets' and policyname = 'tickets_manager_pod'),
  'tickets_manager_pod policy exists');

insert into tenants(id, name) values ('22222222-2222-2222-2222-222222222222', 'T2');
insert into profiles(id, tenant_id, email, name, role) values
  ('cccccccc-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222', 'mgr@t2',  'Mgr',  'manager'),
  ('cccccccc-0000-0000-0000-0000000000c2', '22222222-2222-2222-2222-222222222222', 'cust@t2', 'Cust', 'customer');
insert into customers(id, tenant_id, name, user_id) values
  ('dddddddd-0000-0000-0000-0000000000d1', '22222222-2222-2222-2222-222222222222', 'Acme', 'cccccccc-0000-0000-0000-0000000000c2');
insert into tickets(id, tenant_id, code, subject, type, customer_id) values
  ('eeeeeeee-0000-0000-0000-0000000000e1', '22222222-2222-2222-2222-222222222222', 'TKT-PG1', 'pgtap subject', 'technical', 'dddddddd-0000-0000-0000-0000000000d1');
insert into ticket_messages(tenant_id, ticket_id, author_role, body) values
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-0000-0000-0000-0000000000e1', 'customer', 'hello');

-- as the tenant's manager
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"manager","profile_id":"cccccccc-0000-0000-0000-0000000000c1"}';

select is((select count(*)::int from tickets where id = 'eeeeeeee-0000-0000-0000-0000000000e1'), 1,
  'manager sees the tenant ticket');
select is((select count(*)::int from ticket_messages where ticket_id = 'eeeeeeee-0000-0000-0000-0000000000e1'), 1,
  'manager sees the ticket thread');
select ok(ticket_participant('eeeeeeee-0000-0000-0000-0000000000e1'),
  'manager is a ticket participant (may reply + set status)');

-- a manager in a DIFFERENT tenant must not see it
set local request.jwt.claims = '{"tenant_id":"33333333-3333-3333-3333-333333333333","app_role":"manager","profile_id":"cccccccc-0000-0000-0000-0000000000c1"}';
select is((select count(*)::int from tickets where id = 'eeeeeeee-0000-0000-0000-0000000000e1'), 0,
  'a manager in another tenant does NOT see the ticket');

reset role;
select * from finish();
rollback;
