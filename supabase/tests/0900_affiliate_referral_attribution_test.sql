-- Referral attribution (20260726120000). A customer who signs up through /r/<code> is claimed for that
-- affiliate — derived from the CALLER's claims, never a client-supplied customer id — and a referred sale
-- then accrues onto the partner's lifetime volume so the tier can climb.
begin;
select plan(15);

select has_function('attribute_referral', 'attribute_referral() exists');
select ok(has_function_privilege('authenticated', 'attribute_referral(text)', 'execute'),
          'a signed-in customer may claim their own referral');

-- ── fixtures (as superuser — RLS would block these inserts from a client role) ────────────────────────
insert into tenants(id, name) values ('88888888-8888-8888-8888-888888888888', 'Attr');
insert into profiles(id, tenant_id, email, name, role) values
  ('88880000-0000-4000-8000-0000000000a1', '88888888-8888-8888-8888-888888888888', 'aff1@a', 'Aff One', 'affiliate'),
  ('88880000-0000-4000-8000-0000000000c1', '88888888-8888-8888-8888-888888888888', 'c1@a', 'Cust One', 'customer'),
  ('88880000-0000-4000-8000-0000000000c2', '88888888-8888-8888-8888-888888888888', 'c2@a', 'Cust Two', 'customer'),
  ('88880000-0000-4000-8000-0000000000c3', '88888888-8888-8888-8888-888888888888', 'c3@a', 'Cust Three', 'customer');
insert into affiliates(id, tenant_id, user_id, code, tier, status, joined_at) values
  ('88880000-0000-4000-8000-0000000000f1', '88888888-8888-8888-8888-888888888888', '88880000-0000-4000-8000-0000000000a1', 'AONE', 'bronze', 'active',  '2026-01-01'),
  ('88880000-0000-4000-8000-0000000000f2', '88888888-8888-8888-8888-888888888888', null,                                   'ATWO', 'bronze', 'pending', '2026-01-01');
insert into customers(id, tenant_id, user_id, name, company, email) values
  ('88880000-0000-4000-8000-0000000000d1', '88888888-8888-8888-8888-888888888888', '88880000-0000-4000-8000-0000000000c1', 'C1', 'Co1', 'c1@a'),
  ('88880000-0000-4000-8000-0000000000d2', '88888888-8888-8888-8888-888888888888', '88880000-0000-4000-8000-0000000000c2', 'C2', 'Co2', 'c2@a'),
  ('88880000-0000-4000-8000-0000000000d3', '88888888-8888-8888-8888-888888888888', '88880000-0000-4000-8000-0000000000c3', 'C3', 'Co3', 'c3@a'),
  -- the partner also buys services under their own account. Without this row the self-referral case exits
  -- early on "caller has no customer row" and the self-referral guard is never actually exercised — the
  -- assertion below would pass even with that guard deleted.
  ('88880000-0000-4000-8000-0000000000da', '88888888-8888-8888-8888-888888888888', '88880000-0000-4000-8000-0000000000a1', 'Aff One', 'AffCo', 'aff1@a');
-- C3 has already bought something — an established account, not a fresh referral
insert into orders(id, tenant_id, customer_id, code, service, state, value) values
  ('88880000-0000-4000-8000-0000000000b9', '88888888-8888-8888-8888-888888888888', '88880000-0000-4000-8000-0000000000d3', 'AT-9', 'Optimization', 'new', 100);

-- ── a fresh customer signing up under a live code is claimed ─────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"88888888-8888-8888-8888-888888888888","app_role":"customer","profile_id":"88880000-0000-4000-8000-0000000000c1"}';
select isnt(attribute_referral('AONE'), null, 'a fresh customer is attributed to the code they arrived with');
-- lower-case / punctuated codes are normalised the same way /r/<code> normalises them
select is(attribute_referral('a-one'), null, 'a second claim is a no-op — first referrer wins');
reset role;

select is((select count(*) from affiliate_referrals where customer_id = '88880000-0000-4000-8000-0000000000d1')::int,
          1, 'exactly one referral row for the customer');
select is((select affiliate_id from affiliate_referrals where customer_id = '88880000-0000-4000-8000-0000000000d1'),
          '88880000-0000-4000-8000-0000000000f1'::uuid, 'linked to the affiliate that owns the code');
select is((select volume from affiliate_referrals where customer_id = '88880000-0000-4000-8000-0000000000d1')::numeric,
          0::numeric, 'volume starts at zero — a signup is not a sale');

-- ── the ways attribution must REFUSE ─────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"88888888-8888-8888-8888-888888888888","app_role":"customer","profile_id":"88880000-0000-4000-8000-0000000000c2"}';
select is(attribute_referral('NOSUCH'), null, 'an unknown code attributes nobody');
select is(attribute_referral('ATWO'), null, 'a not-yet-active partner earns no attribution');
reset role;
select is((select count(*) from affiliate_referrals where customer_id = '88880000-0000-4000-8000-0000000000d2')::int,
          0, 'and no row is written for those refusals');

-- an established customer (already has orders) cannot be re-sold to a partner
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"88888888-8888-8888-8888-888888888888","app_role":"customer","profile_id":"88880000-0000-4000-8000-0000000000c3"}';
select is(attribute_referral('AONE'), null, 'CRITICAL: an existing customer who already ordered cannot be poached');
reset role;

-- the affiliate cannot refer themselves
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"88888888-8888-8888-8888-888888888888","app_role":"affiliate","profile_id":"88880000-0000-4000-8000-0000000000a1"}';
select is(attribute_referral('AONE'), null, 'CRITICAL: self-referral is refused');
reset role;
select is((select count(*) from affiliate_referrals where customer_id = '88880000-0000-4000-8000-0000000000da')::int,
          0, 'and the partner never becomes their own referred customer');

-- ── a referred sale accrues onto the partner's lifetime volume (the tier ladder) ─────────────────────
insert into orders(id, tenant_id, customer_id, code, service, state, value) values
  ('88880000-0000-4000-8000-0000000000b1', '88888888-8888-8888-8888-888888888888', '88880000-0000-4000-8000-0000000000d1', 'AT-1', 'Optimization', 'delivered', 800);
update orders set state = 'approved' where id = '88880000-0000-4000-8000-0000000000b1';
select is((select volume from affiliate_referrals where customer_id = '88880000-0000-4000-8000-0000000000d1')::numeric,
          800::numeric, 'the approved sale accrues onto the referral volume — the tier can now climb');
select is((select balance from affiliate_commission where affiliate_id = '88880000-0000-4000-8000-0000000000f1')::numeric,
          80::numeric, 'and the partner is still paid at the rate in force when it was approved (800 x 10%)');

select * from finish();
rollback;
