-- Lane D inc-D3: a staffer requests a payout from their own commission wallet. MONEY (gác③).
-- Claims-derived + hardened like advance/cancel (ADR): the fn reads the requester's identity from the
-- JWT (current_profile_id / current_app_role / current_tenant_id) — never trusts a passed staff id — so
-- it is safe to grant to `authenticated` (the staffer calls it via their own session). Atomic: it locks
-- the wallet, enforces min + sufficiency, debits via wallet_ledger (kind='payout'), and records the
-- request. Admin later approves/pays/rejects (reject = refund, a later increment). Keeps the K11
-- invariant balance == SUM(wallet_ledger).
create or replace function request_payout(p_amount numeric, p_method uuid default null)
returns payout_requests
language plpgsql security definer
set search_path = public
as $$
declare
  v_staff  uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_role   text := current_app_role();
  v_req    payout_requests;
begin
  if v_role <> 'staff' then raise exception 'NOT_STAFF'; end if;
  if p_amount < 50 then raise exception 'BELOW_MIN'; end if;   -- MIN_PAYOUT
  -- a chosen method must belong to this staffer
  if p_method is not null and not exists (
    select 1 from staff_payout_methods where id = p_method and staff_id = v_staff and tenant_id = v_tenant
  ) then
    raise exception 'BAD_METHOD';
  end if;

  -- atomic debit: lock the wallet row AND check sufficiency in one statement (no negative balance)
  update staff_wallet set balance = balance - p_amount, updated_at = now()
   where staff_id = v_staff and tenant_id = v_tenant and balance >= p_amount;
  if not found then raise exception 'INSUFFICIENT_BALANCE'; end if;

  insert into wallet_ledger(tenant_id, staff_id, amount, kind, note)
       values (v_tenant, v_staff, -p_amount, 'payout', 'payout request');
  insert into payout_requests(tenant_id, staff_id, amount, method_id, status)
       values (v_tenant, v_staff, p_amount, p_method, 'requested')
    returning * into v_req;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_staff, 'payout.requested', 'payout', v_req.id);
  return v_req;
end $$;

-- claims-derived + own-wallet-only → safe for the staffer to call directly (not service-role).
revoke execute on function request_payout(numeric, uuid) from public;
grant  execute on function request_payout(numeric, uuid) to authenticated;
