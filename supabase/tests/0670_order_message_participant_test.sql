-- SECURITY guard for 20260701470000: post_order_message participant gate must not leak via NULL.
-- A customer may not post on a shadow-customer's order; a staffer may not post on an unassigned order;
-- the real owner / assigned staffer still can.
begin;
select plan(4);

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('c0c0c0c0-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'cust@a.com',  'Cust',  'customer'),
  ('a5a5a5a5-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'staff@a.com', 'Staff', 'staff');
insert into customers(id, tenant_id, user_id, name, status) values
  ('00000000-0000-4000-8000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'c0c0c0c0-0000-4000-8000-000000000001', 'Claimed', 'claimed'), -- owned by the customer
  ('00000000-0000-4000-8000-0000000000c2', '11111111-1111-1111-1111-111111111111', null, 'Shadow', 'shadow');                                        -- unclaimed shadow
insert into orders(id, tenant_id, code, customer_id, service, value, assignee_id) values
  ('0d000000-0000-4000-8000-00000000000a', '11111111-1111-1111-1111-111111111111', 'OWN', '00000000-0000-4000-8000-0000000000c1', 'Keyword', 100, null),                                    -- customer's own, unassigned
  ('0d000000-0000-4000-8000-00000000000b', '11111111-1111-1111-1111-111111111111', 'SHD', '00000000-0000-4000-8000-0000000000c2', 'Keyword', 100, null),                                    -- shadow customer's
  ('0d000000-0000-4000-8000-00000000000c', '11111111-1111-1111-1111-111111111111', 'ASG', '00000000-0000-4000-8000-0000000000c1', 'Keyword', 100, 'a5a5a5a5-0000-4000-8000-000000000001'); -- assigned to the staffer

set local role authenticated;

-- customer acting
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"c0c0c0c0-0000-4000-8000-000000000001"}';
select lives_ok($$ select post_order_message('0d000000-0000-4000-8000-00000000000a', 'hi', false) $$, 'owning customer can post on their own order');
select throws_ok($$ select post_order_message('0d000000-0000-4000-8000-00000000000b', 'hack', false) $$, 'NOT_PARTICIPANT', 'CRITICAL: customer CANNOT post on a shadow-customer order (NULL leak closed)');

-- staff acting
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"a5a5a5a5-0000-4000-8000-000000000001"}';
select throws_ok($$ select post_order_message('0d000000-0000-4000-8000-00000000000a', 'x', true) $$, 'NOT_PARTICIPANT', 'staff CANNOT post on an unassigned order');
select lives_ok($$ select post_order_message('0d000000-0000-4000-8000-00000000000c', 'note', true) $$, 'assigned staffer can post on their order');

select * from finish();
rollback;
