-- Two order/quote-lifecycle fns 0820/0570 left uncovered:
--   · decline_quote — the customer's "no" on a priced quote (sibling of accept_quote, which 0820 pins).
--   · revise_delivered — a staffer re-opening a DELIVERED order with a fresh, already-approved deliverable,
--     restarting the customer's review window. It touches delivered_at, so it moves the recognition clock.
-- Both are authz-gated and own-scoped; neither had a test.
begin;
select plan(15);

-- ══ decline_quote ═══════════════════════════════════════════════════════════════════════════════════
select has_function('decline_quote', 'decline_quote() exists');
select ok(not has_function_privilege('anon', 'decline_quote(text)', 'execute'), 'anon cannot decline a quote');

insert into tenants(id, name) values ('66666666-6666-6666-6666-666666666666', 'QR');
insert into profiles(id, tenant_id, email, name, role) values
  ('66660000-0000-4000-8000-0000000000a1', '66666666-6666-6666-6666-666666666666', 'm@qr',  'M',  'manager'),
  ('66660000-0000-4000-8000-0000000000b1', '66666666-6666-6666-6666-666666666666', 's1@qr', 'S1', 'staff'),
  ('66660000-0000-4000-8000-0000000000b2', '66666666-6666-6666-6666-666666666666', 's2@qr', 'S2', 'staff'),
  ('66660000-0000-4000-8000-0000000000c1', '66666666-6666-6666-6666-666666666666', 'c1@qr', 'C1', 'customer'),
  ('66660000-0000-4000-8000-0000000000c2', '66666666-6666-6666-6666-666666666666', 'c2@qr', 'C2', 'customer');
insert into customers(id, tenant_id, user_id, name, company, email) values
  ('66660000-0000-4000-8000-0000000000d1', '66666666-6666-6666-6666-666666666666', '66660000-0000-4000-8000-0000000000c1', 'C1', 'One', 'c1@qr'),
  ('66660000-0000-4000-8000-0000000000d2', '66666666-6666-6666-6666-666666666666', '66660000-0000-4000-8000-0000000000c2', 'C2', 'Two', 'c2@qr');
-- all fixture writes happen here, as the superuser, BEFORE dropping to authenticated — orders has no
-- INSERT policy, so inserting these after the role switch would be denied by RLS and abort the file.
-- O1 delivered (assignee S1), O2 in_progress (assignee S1), for the revise_delivered section below.
insert into orders(id, tenant_id, customer_id, code, service, state, value, assignee_id) values
  ('66660000-0000-4000-8000-0000000000e1', '66666666-6666-6666-6666-666666666666', '66660000-0000-4000-8000-0000000000d1', 'QR-1', 'Optimization', 'delivered',   140, '66660000-0000-4000-8000-0000000000b1'),
  ('66660000-0000-4000-8000-0000000000e2', '66666666-6666-6666-6666-666666666666', '66660000-0000-4000-8000-0000000000d1', 'QR-2', 'Optimization', 'in_progress', 140, '66660000-0000-4000-8000-0000000000b1');

-- customer asks (service-role path, as the order action does); capture the token before dropping privilege
select request_quote('66666666-6666-6666-6666-666666666666', '66660000-0000-4000-8000-0000000000d1',
                     'Optimization', 'ultra', 'Ultra', 'OP', '[]'::jsonb, 'big site');
select set_config('test.qtoken', (select token from quotes where tenant_id = '66666666-6666-6666-6666-666666666666' limit 1), true);
select set_config('test.qid',    (select id::text from quotes where tenant_id = '66666666-6666-6666-6666-666666666666' limit 1), true);

set local role authenticated;

-- manager prices it → 'quoted'
set local request.jwt.claims = '{"tenant_id":"66666666-6666-6666-6666-666666666666","app_role":"manager","profile_id":"66660000-0000-4000-8000-0000000000a1"}';
select create_quote(current_setting('test.qid')::uuid, 200, 'priced', 14);
-- a manager (non-customer) cannot decline
select throws_ok($$ select decline_quote(current_setting('test.qtoken')) $$, 'NOT_AUTHORIZED', 'only the customer decides — a manager cannot decline');

-- a bad token, then the wrong customer, then the owner
set local request.jwt.claims = '{"tenant_id":"66666666-6666-6666-6666-666666666666","app_role":"customer","profile_id":"66660000-0000-4000-8000-0000000000c1"}';
select throws_ok($$ select decline_quote('no-such-token') $$, 'QUOTE_NOT_FOUND', 'an unknown token is rejected');
set local request.jwt.claims = '{"tenant_id":"66666666-6666-6666-6666-666666666666","app_role":"customer","profile_id":"66660000-0000-4000-8000-0000000000c2"}';
select throws_ok($$ select decline_quote(current_setting('test.qtoken')) $$, 'NOT_YOUR_QUOTE', 'CRITICAL: a customer cannot decline someone else''s quote');
set local request.jwt.claims = '{"tenant_id":"66666666-6666-6666-6666-666666666666","app_role":"customer","profile_id":"66660000-0000-4000-8000-0000000000c1"}';
select decline_quote(current_setting('test.qtoken'));
select is((select status from quotes where id = current_setting('test.qid')::uuid), 'declined', 'the owner declining marks it declined');
select throws_ok($$ select decline_quote(current_setting('test.qtoken')) $$, 'QUOTE_NOT_OPEN', 'a decided quote cannot be declined again');

-- ══ revise_delivered ════════════════════════════════════════════════════════════════════════════════
select has_function('revise_delivered', 'revise_delivered() exists');
select ok(not has_function_privilege('anon', 'revise_delivered(uuid,text,jsonb)', 'execute'), 'anon cannot revise');

-- only staff, only the assignee, only a delivered order (O1/O2 seeded up top)
set local request.jwt.claims = '{"tenant_id":"66666666-6666-6666-6666-666666666666","app_role":"customer","profile_id":"66660000-0000-4000-8000-0000000000c1"}';
select throws_ok($$ select revise_delivered('66660000-0000-4000-8000-0000000000e1'::uuid, 'x', '[]'::jsonb) $$, 'NOT_STAFF', 'a customer cannot revise a delivery');
set local request.jwt.claims = '{"tenant_id":"66666666-6666-6666-6666-666666666666","app_role":"staff","profile_id":"66660000-0000-4000-8000-0000000000b2"}';
select throws_ok($$ select revise_delivered('66660000-0000-4000-8000-0000000000e1'::uuid, 'x', '[]'::jsonb) $$, 'NOT_REVISABLE', 'CRITICAL: a staffer cannot revise an order that is not theirs');
set local request.jwt.claims = '{"tenant_id":"66666666-6666-6666-6666-666666666666","app_role":"staff","profile_id":"66660000-0000-4000-8000-0000000000b1"}';
select throws_ok($$ select revise_delivered('66660000-0000-4000-8000-0000000000e2'::uuid, 'x', '[]'::jsonb) $$, 'NOT_REVISABLE', 'only a DELIVERED order can be revised (not one still in progress)');

-- the assignee revises the delivered order: a fresh, already-approved deliverable, versioned
create temp table rev1 as select * from revise_delivered('66660000-0000-4000-8000-0000000000e1'::uuid, 'first revision', '[]'::jsonb);
select is((select version from rev1)::int, 1, 'the first revision is version 1');
select is((select status from rev1), 'approved', 'a revision is recorded already approved — it restarts the review window, not the queue');
select is((revise_delivered('66660000-0000-4000-8000-0000000000e1'::uuid, 'second revision', '[]'::jsonb)).version::int, 2, 'a further revision increments the version');

select * from finish();
rollback;
