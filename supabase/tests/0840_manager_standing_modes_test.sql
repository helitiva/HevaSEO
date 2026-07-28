-- Manager standing modes: away→auto-assign (20260709120000) and auto-review (20260710120000).
--
-- WHY THIS FILE EXISTS. These two features were the only entirely-untested area of the money/authz
-- surface, and one of them guards a check that has ALREADY regressed once: advance_order's manager
-- pod-ownership gate. 20260702110000 added it; 20260702130000 redefined advance_order WITHOUT it, so a
-- manager could advance orders outside their own pod; 20260710120000 had to restore it (see its header).
-- Nothing has stopped it dropping again — until this file. Assertion #14 is that regression guard.
--
-- Also pinned: the two toggles are manager-only, the two internal fns are NOT client-callable (a staffer
-- must not be able to self-approve by calling auto_review_order directly), auto-assign is pod-scoped
-- (an away manager's sweep never routes work their pod can't serve), and an auto-reviewed order is
-- stamped delivered_at — i.e. it recognizes revenue exactly like a hand-reviewed delivery.
begin;
select plan(20);

-- ── existence + execute-grants (static, before any role switch) ──────────────────────────────────────
select has_function('auto_assign_order',  'auto_assign_order() exists');
select has_function('auto_review_order',  'auto_review_order() exists');
select has_function('set_away_auto_assign', 'set_away_auto_assign() exists');
select has_function('set_auto_review',    'set_auto_review() exists');
select ok(not has_function_privilege('authenticated', 'auto_assign_order(uuid)', 'execute'),
          'CRITICAL: auto_assign_order is service-role only — a client cannot route work to itself');
select ok(not has_function_privilege('authenticated', 'auto_review_order(uuid)', 'execute'),
          'CRITICAL: auto_review_order is internal — a staffer cannot self-approve by calling it directly');
select ok(not has_function_privilege('anon', 'set_away_auto_assign(boolean)', 'execute'), 'anon cannot flip the away toggle');
select ok(has_function_privilege('authenticated', 'set_away_auto_assign(boolean)', 'execute'), 'the away toggle is manager-facing (authenticated + in-fn role gate)');
select ok(has_function_privilege('authenticated', 'set_auto_review(boolean)', 'execute'), 'the auto-review toggle is manager-facing');

-- ── fixture: two pods in one tenant ──────────────────────────────────────────────────────────────────
insert into tenants(id, name) values ('33333333-3333-3333-3333-333333333333', 'Standing');
insert into profiles(id, tenant_id, email, name, role) values
  ('33330000-0000-4000-8000-0000000000a1', '33333333-3333-3333-3333-333333333333', 'm1@s', 'M1', 'manager'),
  ('33330000-0000-4000-8000-0000000000a2', '33333333-3333-3333-3333-333333333333', 'm2@s', 'M2', 'manager'),
  ('33330000-0000-4000-8000-0000000000b1', '33333333-3333-3333-3333-333333333333', 's1@s', 'S1', 'staff'),
  ('33330000-0000-4000-8000-0000000000b2', '33333333-3333-3333-3333-333333333333', 's2@s', 'S2', 'staff'),
  ('33330000-0000-4000-8000-0000000000c1', '33333333-3333-3333-3333-333333333333', 'c1@s', 'C1', 'customer');
-- S1 is M1's pod (skill: backlink); S2 is M2's pod (skill: content)
insert into staff_details(tenant_id, profile_id, manager_id, active, capacity, skills) values
  ('33333333-3333-3333-3333-333333333333', '33330000-0000-4000-8000-0000000000b1', '33330000-0000-4000-8000-0000000000a1', true, 5, '{backlink}'),
  ('33333333-3333-3333-3333-333333333333', '33330000-0000-4000-8000-0000000000b2', '33330000-0000-4000-8000-0000000000a2', true, 5, '{content}');
insert into customers(id, tenant_id, user_id, name, company, email) values
  ('33330000-0000-4000-8000-0000000000d1', '33333333-3333-3333-3333-333333333333', '33330000-0000-4000-8000-0000000000c1', 'C1', 'Cco', 'c1@s');
-- O1: S1's work, sitting in internal_review (for the pod-ownership check)
-- O2: S1's work, in_progress (for the auto-review pass-through)
-- O3: unassigned Backlink lead (S1 can serve) · O4: unassigned Content lead (only S2's pod can serve)
insert into orders(id, tenant_id, customer_id, code, service, state, value, assignee_id) values
  ('33330000-0000-4000-8000-0000000000e1', '33333333-3333-3333-3333-333333333333', '33330000-0000-4000-8000-0000000000d1', 'SM-1', 'Backlink', 'internal_review', 100, '33330000-0000-4000-8000-0000000000b1'),
  ('33330000-0000-4000-8000-0000000000e2', '33333333-3333-3333-3333-333333333333', '33330000-0000-4000-8000-0000000000d1', 'SM-2', 'Backlink', 'in_progress',     100, '33330000-0000-4000-8000-0000000000b1'),
  ('33330000-0000-4000-8000-0000000000e3', '33333333-3333-3333-3333-333333333333', '33330000-0000-4000-8000-0000000000d1', 'SM-3', 'Backlink', 'new',             100, null),
  ('33330000-0000-4000-8000-0000000000e4', '33333333-3333-3333-3333-333333333333', '33330000-0000-4000-8000-0000000000d1', 'SM-4', 'Content',  'new',             100, null);

set local role authenticated;

-- ── the toggles are manager-only ─────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"tenant_id":"33333333-3333-3333-3333-333333333333","app_role":"staff","profile_id":"33330000-0000-4000-8000-0000000000b1"}';
select throws_ok($$ select set_away_auto_assign(true) $$, 'NOT_MANAGER', 'a staffer cannot flip away→auto-assign');
select throws_ok($$ select set_auto_review(true) $$,      'NOT_MANAGER', 'a staffer cannot flip auto-review');
set local request.jwt.claims = '{"tenant_id":"33333333-3333-3333-3333-333333333333","app_role":"customer","profile_id":"33330000-0000-4000-8000-0000000000c1"}';
select throws_ok($$ select set_away_auto_assign(true) $$, 'NOT_MANAGER', 'a customer cannot flip away→auto-assign');

-- ── THE POD CHECK (the regression this file exists for) ──────────────────────────────────────────────
-- M2 does not manage S1, so M2 must not be able to touch S1's order.
set local request.jwt.claims = '{"tenant_id":"33333333-3333-3333-3333-333333333333","app_role":"manager","profile_id":"33330000-0000-4000-8000-0000000000a2"}';
select throws_ok($$ select advance_order('33330000-0000-4000-8000-0000000000e1'::uuid, 'delivered'::order_state) $$,
                 'NOT_YOUR_POD',
                 'CRITICAL: a manager cannot advance an order worked outside their own pod');
-- M1 does manage S1, so the same transition is allowed.
set local request.jwt.claims = '{"tenant_id":"33333333-3333-3333-3333-333333333333","app_role":"manager","profile_id":"33330000-0000-4000-8000-0000000000a1"}';
select is((advance_order('33330000-0000-4000-8000-0000000000e1'::uuid, 'delivered'::order_state)).state::text,
          'delivered', 'the pod manager CAN advance their own pod''s order');

-- ── auto-review: the pod manager's standing approval delivers straight through ───────────────────────
-- The ground-truth reads below run as the superuser (reset role), not through a client's RLS lens:
-- staff and managers read orders via scoped policies / the orders_mgr view, so `select … from orders`
-- as a client returns no row. This file tests the FUNCTIONS' effect; the read policies are pinned in
-- 0180_money_stripped_views. advance_order's own return value IS visible (SECURITY DEFINER returns it).
select set_auto_review(true);  -- M1 turns it on (still manager claims from the pod-check above)
set local request.jwt.claims = '{"tenant_id":"33333333-3333-3333-3333-333333333333","app_role":"staff","profile_id":"33330000-0000-4000-8000-0000000000b1"}';
select is((advance_order('33330000-0000-4000-8000-0000000000e2'::uuid, 'internal_review'::order_state)).state::text,
          'delivered', 'submitting into an auto-review pod delivers in the same transaction');
reset role;
select isnt((select delivered_at from orders where id = '33330000-0000-4000-8000-0000000000e2'), null,
            'an auto-reviewed order is stamped delivered_at — it recognizes revenue like a manual delivery');
set local role authenticated;

-- ── away → auto-assign: sweep is pod-scoped ──────────────────────────────────────────────────────────
set local request.jwt.claims = '{"tenant_id":"33333333-3333-3333-3333-333333333333","app_role":"manager","profile_id":"33330000-0000-4000-8000-0000000000a1"}';
select is(set_away_auto_assign(true), 1, 'turning away ON sweeps exactly the one lead M1''s pod can serve (the Backlink one)');
select is(my_away_auto_assign(), true, 'my_away_auto_assign reflects the flag just set');
reset role;  -- ground truth: managers read orders through orders_mgr, never the base table
select is((select assignee_id from orders where id = '33330000-0000-4000-8000-0000000000e3'),
          '33330000-0000-4000-8000-0000000000b1'::uuid, 'the Backlink lead auto-routed to the skilled pod staffer');
select is((select assignee_id from orders where id = '33330000-0000-4000-8000-0000000000e4'), null,
          'CRITICAL: the Content lead stays unassigned — an away manager''s sweep never routes work their pod can''t serve');

select * from finish();
rollback;
