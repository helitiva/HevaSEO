-- A suspended partner must stop earning.
--
-- Admin "Suspend / Reject" is a real, wired action: setAffiliateStatusAction → set_affiliate_status maps
-- 'suspended' → affiliates.status = 'churned'. attribute_referral already refuses to attribute NEW
-- customers to a non-active partner — but post_referral_commission looked the referrer up with no status
-- check, so a suspended partner kept earning commission on their existing referred customers' new orders
-- (proven: a churned JANESEO was still paid $40 on an approved order). Suspension that doesn't stop the
-- money isn't suspension.
--
-- Gate the payout on the affiliate being active. A suspended partner's referred orders now post nothing
-- (and nothing accrues to their volume/tier); reactivating them resumes commission on future approvals.
-- Everything else is preserved verbatim: per-order idempotency, the denormalised order_value, the volume
-- accrual for the tier ladder, and the audit row. Signature is unchanged so the pgTAP that names it holds.
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

  -- who referred this customer? (one referral row per referred customer) — and only if the partner is
  -- still ACTIVE. A suspended/churned affiliate earns nothing on new orders.
  select r.id, r.affiliate_id into v_ref, v_aff
    from affiliate_referrals r
    join affiliates a on a.id = r.affiliate_id
   where r.customer_id = v_customer and r.tenant_id = v_tenant and a.status = 'active'
   limit 1;
  if v_aff is null then return; end if;   -- not referred, or the referrer is suspended → nothing to pay

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
