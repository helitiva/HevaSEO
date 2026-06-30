-- Lane D inc-D4: admin resolves a staff payout request. MONEY (gác③). Admin-gated (claims role must be
-- 'admin') + atomic. approve → 'approved'; pay → 'paid' (funds already debited at request time, so no
-- balance change); reject → 'rejected' AND REFUNDS the held amount back to the staffer's wallet (the
-- request_payout debit is reversed), keeping balance == SUM(wallet_ledger). Idempotent: a paid/rejected
-- request can't be re-resolved.
create or replace function resolve_payout(p_request uuid, p_action text)
returns payout_requests
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor  uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_role   text := current_app_role();
  v_req    payout_requests;
begin
  if v_role <> 'admin' then raise exception 'NOT_ADMIN'; end if;

  select * into v_req from payout_requests where id = p_request and tenant_id = v_tenant for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status in ('paid', 'rejected') then raise exception 'ALREADY_RESOLVED'; end if;

  if p_action = 'approve' then
    update payout_requests set status = 'approved', resolved_at = now() where id = p_request returning * into v_req;
  elsif p_action = 'pay' then
    update payout_requests set status = 'paid', resolved_at = now() where id = p_request returning * into v_req;
  elsif p_action = 'reject' then
    -- reverse the request-time debit: refund the held amount to the staffer's wallet
    update staff_wallet set balance = balance + v_req.amount, updated_at = now()
     where staff_id = v_req.staff_id and tenant_id = v_tenant;
    insert into wallet_ledger(tenant_id, staff_id, amount, kind, note)
         values (v_tenant, v_req.staff_id, v_req.amount, 'adjustment', 'payout rejected — refund');
    update payout_requests set status = 'rejected', resolved_at = now() where id = p_request returning * into v_req;
  else
    raise exception 'BAD_ACTION';
  end if;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'payout.' || p_action, 'payout', p_request);
  return v_req;
end $$;

revoke execute on function resolve_payout(uuid, text) from public;
grant  execute on function resolve_payout(uuid, text) to authenticated;
