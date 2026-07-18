-- Affiliate commission posts to the wallet when a referred order is APPROVED (customer approves the
-- delivered work, or auto_approve_stale_deliveries does it after the grace window). Until now
-- post_affiliate_commission had no order-event caller, so a partner's wallet stayed $0 while the
-- overview/referrals showed attributed commission — the affiliate twin of the staff-wallet gap.
--
-- Design: a single AFTER-UPDATE trigger on orders that fires when state ENTERS 'approved'. It catches
-- BOTH paths (advance_order and auto_approve both do `update orders set state='approved'`), so neither
-- of those SECURITY DEFINER functions has to be redefined — which is what keeps dropping the manager
-- pod-ownership check (see 0840). Idempotency is a per-order unique index, so a re-approval
-- (approved → changes_requested → approved) never pays twice.

-- ── per-order idempotency + the order value on the row ────────────────────────────────────────────────
-- order_id gives one-commission-per-order; order_value is denormalised onto the ledger so the affiliate's
-- payouts page can show "$X order · Y%" without reading the orders table (which RLS hides from affiliates).
alter table commission_ledger add column if not exists order_id uuid references orders(id) on delete set null;
alter table commission_ledger add column if not exists order_value numeric;
create unique index if not exists commission_ledger_order_commission_uniq
  on commission_ledger(order_id) where kind = 'commission' and order_id is not null;

-- ── the affiliate's effective rate — volume-derived, matching the UI (tierForIn over the default ladder,
--    which the app uses whenever affiliate_tier_config is empty). Rates mirror lib/affiliate AFFILIATE_TIERS. ─
create or replace function affiliate_effective_rate(p_affiliate uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v_volume numeric;
begin
  select coalesce(sum(volume), 0) into v_volume from affiliate_referrals where affiliate_id = p_affiliate;
  return case
    when v_volume >= 50000 then 0.25   -- platinum
    when v_volume >= 20000 then 0.20   -- gold
    when v_volume >=  5000 then 0.15   -- silver
    else 0.10                          -- bronze
  end;
end $$;

-- ── post the commission for one just-approved order, once ────────────────────────────────────────────
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

  -- who referred this customer? (one referral row per referred customer)
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
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_tenant, p_actor, 'affiliate.commission.posted', 'order', p_order,
               jsonb_build_object('amount', v_amount, 'affiliate', v_aff));
end $$;
revoke execute on function post_referral_commission(uuid, uuid) from public;

-- ── the trigger: fire when an order ENTERS 'approved', by whatever path ───────────────────────────────
create or replace function trg_post_referral_commission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform post_referral_commission(new.id, current_profile_id());
  return null;  -- AFTER trigger; return value ignored
end $$;

drop trigger if exists orders_approved_commission on orders;
create trigger orders_approved_commission
  after update of state on orders
  for each row
  when (new.state = 'approved' and old.state is distinct from 'approved')
  execute function trg_post_referral_commission();
