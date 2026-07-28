-- inc-E31: pod manager joins the order thread (reads internal+facing on pod orders; posts; non-pod blocked).
begin;
select plan(6);

select has_function('order_pod_manager', 'order_pod_manager() exists');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a031', '11111111-1111-1111-1111-111111111111', 'm1@a', 'M1', 'manager'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a032', '11111111-1111-1111-1111-111111111111', 'm2@a', 'M2', 'manager');
insert into staff_details(tenant_id, profile_id, skills, capacity, manager_id) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '{seo}', 5, 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a031');
insert into customers(id, tenant_id, name, company, email, status) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Acme', 'Acme', 'c@a', 'claimed');
insert into orders(id, tenant_id, customer_id, code, service, value, state, assignee_id) values
  ('00000000-0000-0000-0000-00000000ab01'::uuid, '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'X1', 'Keyword', 60, 'in_progress', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051');
-- an admin-authored internal note + a facing message (seeded pre-role-switch)
insert into order_messages(tenant_id, order_id, author_id, body, internal) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000ab01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', 'internal', true),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000ab01', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', 'facing', false);

set local role authenticated;

-- pod manager (M1) sees BOTH (internal + facing) + can post
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a031"}';
select is((select count(*) from order_messages where order_id = '00000000-0000-0000-0000-00000000ab01')::int, 2, 'pod manager sees internal + facing');
select lives_ok($$ select post_order_message('00000000-0000-0000-0000-00000000ab01','mgr note',true) $$, 'pod manager posts');

-- another manager (M2, not this pod) sees nothing + is blocked from posting
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a032"}';
select is((select count(*) from order_messages where order_id = '00000000-0000-0000-0000-00000000ab01')::int, 0, 'non-pod manager sees nothing');
select throws_ok($$ select post_order_message('00000000-0000-0000-0000-00000000ab01','sneaky',true) $$, 'NOT_PARTICIPANT', 'non-pod manager blocked from posting');

-- back to pod manager: the internal note they posted is visible (now 3)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a031"}';
select is((select count(*) from order_messages where order_id = '00000000-0000-0000-0000-00000000ab01')::int, 3, 'pod manager now sees 3 (incl own note)');

reset role;
select * from finish();
rollback;
