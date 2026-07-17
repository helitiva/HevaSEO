-- revenue_book (20260717160000) — the money book, computed in SQL.
--
-- THE TWIN. The ASC 606 state rules live in two places: the recognized/unearned CTEs in this RPC, and
-- RECOGNIZED_STATES/isBookedState in apps/app/src/data/adminRevenue.ts, which /admin/analytics still
-- needs in TS for breakdowns the RPC doesn't return. adminRevenue.test.ts pins the TS side; this file
-- pins the SQL side against the same documented rule. If the two drift, one of them goes red instead of
-- Finance and Analytics quietly disagreeing about the top line — which is exactly what happened before
-- (analytics counted only state='completed' and reported $0 while Finance reported $296.02 for the very
-- same orders).
--
-- The numbers below are hand-computed from the fixture, not copied from a run. A test that asserts
-- whatever the code already returns proves only that the code is deterministic.
begin;
select plan(20);

select has_function('revenue_book', 'revenue_book() exists');

-- Whole-tenant money: never reachable without a login, and never by a customer or a manager.
select ok(not has_function_privilege('anon', 'revenue_book(int)', 'execute'),
          'CRITICAL: anon CANNOT read the money book');
select ok(has_function_privilege('authenticated', 'revenue_book(int)', 'execute'),
          'authenticated may call it (the admin gate is inside — SECURITY DEFINER bypasses RLS)');

insert into tenants(id, name) values ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-00000000b0a1', '22222222-2222-2222-2222-222222222222', 'adm@b', 'Adm', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-00000000b0a2', '22222222-2222-2222-2222-222222222222', 'mgr@b', 'Mgr', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-00000000b0c1', '22222222-2222-2222-2222-222222222222', 'cus@b', 'Cus', 'customer');
insert into customers(id, tenant_id, user_id, name, company, email) values
  ('dddddddd-dddd-dddd-dddd-00000000c001', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-00000000b0c1', 'Cus', 'Beta', 'cus@b');
insert into customer_balances(customer_id, tenant_id, balance) values
  ('dddddddd-dddd-dddd-dddd-00000000c001', '22222222-2222-2222-2222-222222222222', 400);

-- ── the fixture, hand-totalled ──────────────────────────────────────────────────────────────────────
-- topups        1000 + 500                         = 1500   (the refund below must NOT count)
-- refund        +25                                          (positive, like a topup — the trap)
-- bookings      100+200+400+800 (canceled 1600 out) = 1500
-- recognized    200 (delivered) + 400 (approved) + 800 (completed) = 1400
--               'new' is booked but NOT recognized; changes_requested is booked but un-earned
-- unearned      100 (new) + 0                       = 100
-- nonOrderSpend debit with no order_id              = 75
-- cancelFees    cancel_fee (carries an order_id!)   = 25
insert into orders(id, tenant_id, customer_id, code, service, state, value, created_at, delivered_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', 'B-1', 'Optimization', 'new',        100, now(), null),
  ('eeeeeeee-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', 'B-2', 'Optimization', 'delivered',  200, now(), now()),
  ('eeeeeeee-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', 'B-3', 'Optimization', 'approved',   400, now(), now()),
  ('eeeeeeee-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', 'B-4', 'Optimization', 'completed',  800, now(), now()),
  ('eeeeeeee-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', 'B-5', 'Optimization', 'canceled',  1600, now(), null);
insert into credit_ledger(tenant_id, customer_id, order_id, kind, amount) values
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', null, 'topup',       1000),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', null, 'topup',        500),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', null, 'refund',        25),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', null, 'debit',        -75),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-00000000c001', 'eeeeeeee-0000-0000-0000-000000000005', 'cancel_fee', -25);

set local role authenticated;

-- ── the gate ────────────────────────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"customer","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-00000000b0c1"}';
select throws_ok($$ select revenue_book(30) $$, 'NOT_AUTHORIZED', 'CRITICAL: a customer cannot read whole-tenant revenue');

set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"manager","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-00000000b0a2"}';
select throws_ok($$ select revenue_book(30) $$, 'NOT_AUTHORIZED', 'CRITICAL: managers are money-blind — quotes.manage did not widen this');

set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-00000000b0a1"}';
select throws_ok($$ select revenue_book(0) $$,   'INVALID_WINDOW', 'window must be >= 1');
select throws_ok($$ select revenue_book(401) $$, 'INVALID_WINDOW', 'window is bounded — no unbounded scan from a query param');

-- ── the rules ───────────────────────────────────────────────────────────────────────────────────────
select is(((revenue_book(30) -> 'total' ->> 'deposits')::numeric), 1500::numeric,
          'CRITICAL: deposits = topups ONLY — a refund is positive too, and is not cash collected');

select is(((revenue_book(30) -> 'total' ->> 'bookings')::numeric), 1500::numeric,
          'bookings = every state except canceled (incl. new); a canceled order was never sold');

select is(((revenue_book(30) -> 'total' ->> 'recognized')::numeric), 1400::numeric,
          'recognized = delivered + approved + completed, on delivered_at (ASC 606)');

select ok(((revenue_book(30) -> 'total' ->> 'recognized')::numeric)
          < ((revenue_book(30) -> 'total' ->> 'bookings')::numeric),
          'recognized can never exceed bookings — undelivered work is not revenue');

select is(((revenue_book(30) -> 'deferred' ->> 'unearnedOrders')::numeric), 100::numeric,
          'unearned = booked but undelivered (the new order), not the canceled one');

select is(((revenue_book(30) -> 'deferred' ->> 'unspentCredit')::numeric), 400::numeric,
          'unspent credit comes from customer_balances');

select is(((revenue_book(30) -> 'deferred' ->> 'total')::numeric), 500::numeric,
          'deferred = unspent credit + undelivered work');

select is(((revenue_book(30) -> 'reconcile' ->> 'nonOrderSpend')::numeric), 75::numeric,
          'non-order spend = debits with no order_id');

select is(((revenue_book(30) -> 'reconcile' ->> 'cancelFees')::numeric), 25::numeric,
          'CRITICAL: a cancel_fee carries the cancelled order_id, so it cannot hide inside nonOrderSpend');

-- The identity the Finance page prints: deposits − recognized − nonOrderSpend − cancelFees = deferred.
-- 1500 − 1400 − 75 − 25 = 0 … and deferred is 500, so this fixture deliberately does NOT tie out:
-- balances were seeded by hand rather than by create_order/topup. What must hold is that the RPC
-- REPORTS the mismatch instead of hiding it — a reconcile strip that always says ok is not a check.
select is(((revenue_book(30) -> 'reconcile' ->> 'expected')::numeric), 0::numeric,
          'expected = deposits − recognized − nonOrderSpend − cancelFees');
select is(((revenue_book(30) -> 'reconcile' ->> 'ok')::boolean), false,
          'CRITICAL: the reconcile strip reports a book that does NOT tie out — it is a check, not a decoration');

-- Gaps must render as zeros, or a quiet day disappears from the chart instead of showing as flat.
select is((select jsonb_array_length(revenue_book(30) -> 'days')), 30, 'a 30-day window returns 30 days, gaps included');
select is((select jsonb_array_length(revenue_book(7) -> 'days')),  7,  'the window parameter is honoured');

select * from finish();
rollback;
