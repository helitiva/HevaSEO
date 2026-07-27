-- Affiliate commission posts on approval (20260718170000). A referred customer's order, when it enters
-- 'approved' — by the customer via advance_order or by auto_approve_stale_deliveries — pays the referring
-- affiliate value × their (volume-derived) rate, exactly once.
begin;
select plan(14);

select has_function('affiliate_effective_rate', 'affiliate_effective_rate() exists');
select has_function('post_referral_commission', 'post_referral_commission() exists');
select ok(not has_function_privilege('authenticated', 'post_referral_commission(uuid,uuid)', 'execute'),
          'post_referral_commission is internal — clients cannot mint their own commission');
select ok(exists(select 1 from pg_trigger where tgname = 'orders_approved_commission'),
          'the approve→commission trigger is installed on orders');

-- ── the rate ladder is volume-derived (matches the UI over the default tiers) ─────────────────────────
insert into tenants(id, name) values ('99999999-9999-9999-9999-999999999999', 'Aff');
insert into profiles(id, tenant_id, email, name, role) values
  ('99990000-0000-4000-8000-0000000000a1', '99999999-9999-9999-9999-999999999999', 'a1@a', 'A1', 'affiliate'),
  ('99990000-0000-4000-8000-0000000000a2', '99999999-9999-9999-9999-999999999999', 'a2@a', 'A2', 'affiliate'),
  ('99990000-0000-4000-8000-0000000000c1', '99999999-9999-9999-9999-999999999999', 'c1@a', 'C1', 'customer');
insert into affiliates(id, tenant_id, user_id, code, tier, status, joined_at) values
  ('99990000-0000-4000-8000-0000000000f1', '99999999-9999-9999-9999-999999999999', '99990000-0000-4000-8000-0000000000a1', 'AONE', 'bronze', 'active', '2026-01-01'),
  ('99990000-0000-4000-8000-0000000000f2', '99999999-9999-9999-9999-999999999999', '99990000-0000-4000-8000-0000000000a2', 'ATWO', 'bronze', 'active', '2026-01-01');
insert into customers(id, tenant_id, user_id, name, company, email) values
  ('99990000-0000-4000-8000-0000000000d1', '99999999-9999-9999-9999-999999999999', '99990000-0000-4000-8000-0000000000c1', 'C1', 'Co1', 'c1@a'),
  ('99990000-0000-4000-8000-0000000000d2', '99999999-9999-9999-9999-999999999999', null, 'C2', 'Co2', 'c2@a'),   -- A2's referral
  ('99990000-0000-4000-8000-0000000000d3', '99999999-9999-9999-9999-999999999999', null, 'C3', 'Co3', 'c3@a');   -- referred by nobody
-- A1's pod of referrals totals $1,200 (bronze); A2's totals $6,000 (silver). Each partner needs its OWN
-- referred customer — a customer has exactly one referrer (affiliate_referrals_customer_uniq, 20260726120000).
insert into affiliate_referrals(tenant_id, affiliate_id, customer_id, volume, status) values
  ('99999999-9999-9999-9999-999999999999', '99990000-0000-4000-8000-0000000000f1', '99990000-0000-4000-8000-0000000000d1', 1200, 'active'),
  ('99999999-9999-9999-9999-999999999999', '99990000-0000-4000-8000-0000000000f2', '99990000-0000-4000-8000-0000000000d2', 6000, 'active');

select is(affiliate_effective_rate('99990000-0000-4000-8000-0000000000f1')::numeric, 0.10::numeric, '$1,200 referred → bronze 10%');
select is(affiliate_effective_rate('99990000-0000-4000-8000-0000000000f2')::numeric, 0.15::numeric, '$6,000 referred → silver 15%');

-- ── approving a referred order pays the affiliate, once ───────────────────────────────────────────────
insert into orders(id, tenant_id, customer_id, code, service, state, value, assignee_id) values
  ('99990000-0000-4000-8000-0000000000b1', '99999999-9999-9999-9999-999999999999', '99990000-0000-4000-8000-0000000000d1', 'AF-1', 'Optimization', 'delivered', 500, null),
  ('99990000-0000-4000-8000-0000000000b2', '99999999-9999-9999-9999-999999999999', '99990000-0000-4000-8000-0000000000d3', 'AF-2', 'Optimization', 'delivered', 999, null),
  ('99990000-0000-4000-8000-0000000000b3', '99999999-9999-9999-9999-999999999999', '99990000-0000-4000-8000-0000000000d1', 'AF-3', 'Optimization', 'delivered', 200, '99990000-0000-4000-8000-0000000000c1');

update orders set state = 'approved' where id = '99990000-0000-4000-8000-0000000000b1';
select is((select balance from affiliate_commission where affiliate_id = '99990000-0000-4000-8000-0000000000f1')::numeric,
          50::numeric, 'CRITICAL: approving the $500 order pays A1 $50 (500 × 10%)');
select is((select count(*) from commission_ledger where order_id = '99990000-0000-4000-8000-0000000000b1' and referral_id is not null)::int,
          1, 'the commission row carries both order_id and referral_id');
select is((select order_value from commission_ledger where order_id = '99990000-0000-4000-8000-0000000000b1')::numeric,
          500::numeric, 'and the order value, so the affiliate ledger can show "$X order · Y%" without reading orders');
select is((select balance from affiliate_commission where affiliate_id = '99990000-0000-4000-8000-0000000000f1')::numeric,
          (select coalesce(sum(amount), 0) from commission_ledger where affiliate_id = '99990000-0000-4000-8000-0000000000f1')::numeric,
          'wallet invariant: balance == SUM(commission_ledger)');

-- ── idempotency: a re-approval (bounce → approve again) must not pay twice ────────────────────────────
update orders set state = 'changes_requested' where id = '99990000-0000-4000-8000-0000000000b1';
update orders set state = 'approved' where id = '99990000-0000-4000-8000-0000000000b1';
select is((select balance from affiliate_commission where affiliate_id = '99990000-0000-4000-8000-0000000000f1')::numeric,
          50::numeric, 'CRITICAL: re-approving the same order does NOT pay a second time');
select is((select count(*) from commission_ledger where order_id = '99990000-0000-4000-8000-0000000000b1')::int, 1, 'still exactly one commission row for the order');

-- ── a customer nobody referred earns nobody anything ─────────────────────────────────────────────────
update orders set state = 'approved' where id = '99990000-0000-4000-8000-0000000000b2';
select is((select count(*) from commission_ledger where order_id = '99990000-0000-4000-8000-0000000000b2')::int, 0,
          'an un-referred customer''s approved order posts no commission');

-- ── the real customer-approve path (advance_order) fires the trigger too ─────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"99999999-9999-9999-9999-999999999999","app_role":"customer","profile_id":"99990000-0000-4000-8000-0000000000c1"}';
select advance_order('99990000-0000-4000-8000-0000000000b3'::uuid, 'approved'::order_state);
reset role;
select is((select balance from affiliate_commission where affiliate_id = '99990000-0000-4000-8000-0000000000f1')::numeric,
          70::numeric, 'the customer approving via advance_order pays too: $50 + $20 (200 × 10%) = $70');

select * from finish();
rollback;
