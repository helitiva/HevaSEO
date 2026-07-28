-- Referral ATTRIBUTION — the missing first half of the affiliate funnel.
--
-- The payout engine (20260718170000) pays a referrer when a referred order is approved, but nothing ever
-- CREATED a referral: /r/<code> counted the click and set the 30-day `heva_ref` cookie, and then no code
-- path read it. Every affiliate_referrals row in the system came from seed.sql, so on a real signup the
-- customer was linked to nobody and the commission engine could never fire.
--
-- This adds the attribution primitive + closes the tier gap:
--   1. one referrer per customer, enforced in the schema (the commission lookup's `limit 1` was a guess);
--   2. attribute_referral(code) — claims the signed-in customer for an affiliate, derived from JWT claims;
--   3. post_referral_commission also accrues the order value onto the referral, so the volume-derived
--      tier actually climbs with real sales instead of staying frozen at its seeded value.

-- ── 1. one referrer per customer ─────────────────────────────────────────────────────────────────────
-- Attribution is last-click within the cookie window but FIRST-WIN per customer: once someone is
-- referred, a later link visit cannot re-sell them to another partner. This also makes the
-- customer→referral lookup in post_referral_commission deterministic.
create unique index if not exists affiliate_referrals_customer_uniq
  on affiliate_referrals(customer_id) where customer_id is not null;

-- ── 2. claim the signed-in customer for an affiliate code ────────────────────────────────────────────
-- SECURITY DEFINER because it writes a row the caller cannot write directly (affiliate_referrals has no
-- customer-side INSERT policy). The customer is derived from the CALLER's claims — never a parameter —
-- so a client cannot attribute somebody else, and the code is the only client-supplied input.
--
-- Returns the referral id, or null when nothing was attributed (unknown/inactive code, already referred,
-- self-referral, or a customer who has already ordered). Callers treat null as a no-op: attribution is a
-- best-effort side effect of signup and must never fail the signup itself.
create or replace function attribute_referral(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_profile  uuid := current_profile_id();
  v_tenant   uuid := current_tenant_id();
  v_customer uuid;
  v_aff      uuid;
  v_aff_user uuid;
  v_ref      uuid;
  v_code     text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v_profile is null or v_tenant is null or v_code = '' then return null; end if;

  -- the caller's own customer row (a staff/manager/affiliate caller simply has none → no-op)
  select id into v_customer from customers where user_id = v_profile and tenant_id = v_tenant;
  if v_customer is null then return null; end if;

  -- Only a customer who has never ordered can be attributed. Attribution happens at signup, so this is
  -- normally trivially true; the guard is what stops an established customer from being re-attributed to
  -- a partner later (poaching an account that was won without them).
  if exists (select 1 from orders where customer_id = v_customer) then return null; end if;

  select id, user_id into v_aff, v_aff_user
    from affiliates where tenant_id = v_tenant and code = v_code and status = 'active';
  if v_aff is null then return null; end if;            -- unknown or not-yet-active partner
  if v_aff_user is not null and v_aff_user = v_profile then return null; end if;  -- no self-referral

  insert into affiliate_referrals(tenant_id, affiliate_id, customer_id, volume, status)
       values (v_tenant, v_aff, v_customer, 0, 'active')
  on conflict (customer_id) where customer_id is not null do nothing
  returning id into v_ref;
  if v_ref is null then return null; end if;            -- already referred → first-win, keep the original

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_tenant, v_profile, 'affiliate.referral.attributed', 'affiliate', v_aff,
               jsonb_build_object('customer', v_customer, 'code', v_code));
  return v_ref;
end $$;

revoke execute on function attribute_referral(text) from public;
grant execute on function attribute_referral(text) to authenticated;

-- ── 3. accrue the order value onto the referral so the tier can climb ────────────────────────────────
-- affiliate_effective_rate derives the tier from SUM(affiliate_referrals.volume), but nothing ever moved
-- volume off its seeded value — a partner could sell forever and stay bronze. The commission post is
-- exactly the moment a referred sale is final, so accrue there. The rate is read BEFORE the accrual, so
-- an order is always paid at the rate in force when it was approved.
create or replace function post_referral_commission(p_order uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tenant   uuid;
  v_customer uuid;
  v_value    numeric;
  v_ref      uuid;
  v_aff      uuid;
  v_amount   numeric;
begin
  select tenant_id, customer_id, value into v_tenant, v_customer, v_value from orders where id = p_order;
  if v_customer is null then return; end if;

  -- who referred this customer? (one referral row per referred customer — see the unique index above)
  select id, affiliate_id into v_ref, v_aff
    from affiliate_referrals where customer_id = v_customer and tenant_id = v_tenant limit 1;
  if v_aff is null then return; end if;   -- not a referred customer → nothing to pay

  v_amount := round(v_value * affiliate_effective_rate(v_aff), 2);
  if v_amount <= 0 then return; end if;

  -- one commission per order. If this order already posted, the index conflict makes this a no-op and we
  -- must NOT bump the balance again.
  insert into commission_ledger(tenant_id, affiliate_id, amount, kind, referral_id, order_id, order_value)
       values (v_tenant, v_aff, v_amount, 'commission', v_ref, p_order, v_value)
  on conflict (order_id) where kind = 'commission' and order_id is not null do nothing;
  if not found then return; end if;

  insert into affiliate_commission(affiliate_id, tenant_id, balance) values (v_aff, v_tenant, v_amount)
    on conflict (affiliate_id) do update set balance = affiliate_commission.balance + v_amount, updated_at = now();

  -- the referred sale counts toward the partner's lifetime volume → next order may price at a higher tier
  update affiliate_referrals set volume = volume + v_value where id = v_ref;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_tenant, p_actor, 'affiliate.commission.posted', 'order', p_order,
               jsonb_build_object('amount', v_amount, 'affiliate', v_aff));
end $$;
revoke execute on function post_referral_commission(uuid, uuid) from public;
