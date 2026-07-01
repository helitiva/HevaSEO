-- Lane E inc-E22: Stripe webhook backstop. The webhook has no user session, so these reconcile via a
-- service-role client (SECURITY DEFINER, granted to service_role only — never anon/authenticated).
--   • sync_stripe_account_status: account.updated → mirror payouts_enabled onto the affiliate (backstop
--     for the onboarding-return redirect, which a user might never hit).
--   • revert_affiliate_payout_by_transfer: transfer.reversed → refund the affiliate's commission balance
--     (+ ledger 'adjustment', keeping balance == SUM(ledger)) and mark the payout rejected. Idempotent.
create or replace function sync_stripe_account_status(p_account_id text, p_enabled boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_account_id is null then return; end if;
  update affiliates set stripe_payouts_enabled = coalesce(p_enabled, false) where stripe_account_id = p_account_id;
end $$;

create or replace function revert_affiliate_payout_by_transfer(p_transfer_ref text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_req affiliate_payouts;
begin
  if p_transfer_ref is null then return; end if;
  select * into v_req from affiliate_payouts where provider_ref = p_transfer_ref and status = 'paid' for update;
  if not found then return; end if;  -- idempotent: nothing paid under this transfer

  update affiliate_commission set balance = balance + v_req.amount, updated_at = now()
   where affiliate_id = v_req.affiliate_id and tenant_id = v_req.tenant_id;
  insert into commission_ledger(tenant_id, affiliate_id, amount, kind)
       values (v_req.tenant_id, v_req.affiliate_id, v_req.amount, 'adjustment');
  update affiliate_payouts set status = 'rejected', resolved_at = now() where id = v_req.id;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_req.tenant_id, null, 'affiliate_payout.reversed', 'affiliate_payout', v_req.id);
end $$;

revoke execute on function sync_stripe_account_status(text, boolean) from public;
revoke execute on function revert_affiliate_payout_by_transfer(text) from public;
grant  execute on function sync_stripe_account_status(text, boolean) to service_role;
grant  execute on function revert_affiliate_payout_by_transfer(text) to service_role;
