-- auto_approve_stale_deliveries — the system approves delivered orders whose grace window elapsed
-- (delivered → approved), leaves fresh ones alone, and is service-role-only.
begin;
select plan(8);

select has_function('auto_approve_stale_deliveries', 'auto_approve_stale_deliveries() exists');
select ok(not has_function_privilege('anon', 'auto_approve_stale_deliveries(integer)', 'execute'), 'anon CANNOT auto-approve');
select ok(not has_function_privilege('authenticated', 'auto_approve_stale_deliveries(integer)', 'execute'), 'authenticated CANNOT auto-approve');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into customers(id, tenant_id, name, company, email, status) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Acme', 'Acme', 'c@a', 'claimed');
insert into orders(id, tenant_id, customer_id, code, service, value, state, delivered_at) values
  ('00000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'OLD', 'Audit', 60, 'delivered', now() - interval '8 days'),
  ('00000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'NEW', 'Audit', 60, 'delivered', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a3', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'WIP', 'Audit', 60, 'in_progress', null);

select is(auto_approve_stale_deliveries(7), 1, 'approves exactly the one order past the 7-day grace');
select is((select state::text from orders where id = '00000000-0000-0000-0000-0000000000a1'), 'approved', 'stale delivered → approved');
select is((select state::text from orders where id = '00000000-0000-0000-0000-0000000000a2'), 'delivered', 'fresh delivered untouched');
select is((select state::text from orders where id = '00000000-0000-0000-0000-0000000000a3'), 'in_progress', 'non-delivered untouched');
select is((select count(*) from audit_log where action = 'order.auto_approved' and entity_id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint, 'system auto-approval is audited');

select * from finish();
rollback;
