-- Lane D inc-D6: managers ALSO have a wallet (salary + pod-override commission) and can withdraw — the
-- manager_wallet migration already gives them read access; this lets them REQUEST a payout too. Recreate
-- request_payout so the role guard accepts staff OR manager (own wallet only, still claims-derived).
-- (CREATE OR REPLACE preserves the existing grant to authenticated.)
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
  if v_role not in ('staff', 'manager') then raise exception 'NOT_WORKER'; end if;
  if p_amount < 50 then raise exception 'BELOW_MIN'; end if;
  if p_method is not null and not exists (
    select 1 from staff_payout_methods where id = p_method and staff_id = v_staff and tenant_id = v_tenant
  ) then
    raise exception 'BAD_METHOD';
  end if;

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
