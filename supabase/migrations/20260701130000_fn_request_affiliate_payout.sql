-- Lane E inc-E2: an affiliate requests a payout from their OWN commission balance. Same claims-derived
-- pattern as request_payout (staff): identity from the JWT, own affiliate only, granted to authenticated.
-- commission_ledger/affiliate_commission are SELECT-only via RLS → the write goes through this fn.
-- Atomic debit keeps balance == SUM(commission_ledger) (K11) and never goes negative.
create or replace function request_affiliate_payout(p_amount numeric)
returns affiliate_payouts
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid    uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_role   text := current_app_role();
  v_aff    uuid;
  v_req    affiliate_payouts;
begin
  if v_role <> 'affiliate' then raise exception 'NOT_AFFILIATE'; end if;
  if p_amount < 50 then raise exception 'BELOW_MIN'; end if;   -- MIN_PAYOUT

  select id into v_aff from affiliates where user_id = v_pid and tenant_id = v_tenant;
  if v_aff is null then raise exception 'NOT_AFFILIATE'; end if;

  -- atomic debit: lock the balance row AND enforce sufficiency in one statement (no negative balance)
  update affiliate_commission set balance = balance - p_amount, updated_at = now()
   where affiliate_id = v_aff and tenant_id = v_tenant and balance >= p_amount;
  if not found then raise exception 'INSUFFICIENT_BALANCE'; end if;

  insert into commission_ledger(tenant_id, affiliate_id, amount, kind)
       values (v_tenant, v_aff, -p_amount, 'payout');
  insert into affiliate_payouts(tenant_id, affiliate_id, amount, status)
       values (v_tenant, v_aff, p_amount, 'requested')
    returning * into v_req;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'affiliate_payout.requested', 'affiliate_payout', v_req.id);
  return v_req;
end $$;

revoke execute on function request_affiliate_payout(numeric) from public;
grant  execute on function request_affiliate_payout(numeric) to authenticated;
