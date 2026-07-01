-- Lane E inc-E8: enforce the program config's min_payout in the live payout fn (inc-E7 stored it but
-- nothing read it). request_affiliate_payout now reads affiliate_program_config.min_payout for the
-- tenant, defaulting to 50 when no config row exists. SECURITY DEFINER so it reads the config table
-- regardless of the caller's RLS grant. Everything else (atomic debit, K11 invariant) is unchanged.
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
  v_min    numeric;
  v_req    affiliate_payouts;
begin
  if v_role <> 'affiliate' then raise exception 'NOT_AFFILIATE'; end if;

  -- min withdrawal comes from the program config (inc-E7); default 50 when unconfigured
  v_min := coalesce((select min_payout from affiliate_program_config where tenant_id = v_tenant), 50);
  if p_amount < v_min then raise exception 'BELOW_MIN'; end if;

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
