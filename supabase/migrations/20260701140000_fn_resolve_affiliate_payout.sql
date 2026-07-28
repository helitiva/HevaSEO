-- Lane E inc-E3: admin resolves an affiliate payout request (approve / pay / reject). Mirrors
-- resolve_payout (staff, inc-D4): admin-gated, idempotent (no re-resolving paid/rejected), and reject
-- REFUNDS the request-time debit back to the affiliate's commission balance (+ a ledger 'adjustment'),
-- so balance == SUM(commission_ledger) still holds. commission tables are SELECT-only via RLS → the
-- write goes through this SECURITY DEFINER fn.
create or replace function resolve_affiliate_payout(p_request uuid, p_action text)
returns affiliate_payouts
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor  uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_role   text := current_app_role();
  v_req    affiliate_payouts;
begin
  if v_role <> 'admin' then raise exception 'NOT_ADMIN'; end if;

  select * into v_req from affiliate_payouts where id = p_request and tenant_id = v_tenant for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status in ('paid', 'rejected') then raise exception 'ALREADY_RESOLVED'; end if;

  if p_action = 'approve' then
    update affiliate_payouts set status = 'approved', resolved_at = now() where id = p_request returning * into v_req;
  elsif p_action = 'pay' then
    update affiliate_payouts set status = 'paid', resolved_at = now() where id = p_request returning * into v_req;
  elsif p_action = 'reject' then
    update affiliate_commission set balance = balance + v_req.amount, updated_at = now()
     where affiliate_id = v_req.affiliate_id and tenant_id = v_tenant;
    insert into commission_ledger(tenant_id, affiliate_id, amount, kind)
         values (v_tenant, v_req.affiliate_id, v_req.amount, 'adjustment');
    update affiliate_payouts set status = 'rejected', resolved_at = now() where id = p_request returning * into v_req;
  else
    raise exception 'BAD_ACTION';
  end if;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'affiliate_payout.' || p_action, 'affiliate_payout', p_request);
  return v_req;
end $$;

revoke execute on function resolve_affiliate_payout(uuid, text) from public;
grant  execute on function resolve_affiliate_payout(uuid, text) to authenticated;
