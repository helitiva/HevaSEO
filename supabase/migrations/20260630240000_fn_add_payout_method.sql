-- Lane D polish: a worker (staff or manager) adds their own payout method. MONEY-adjacent (gác③).
-- Same claims-derived pattern as request_payout: identity comes from the JWT, never a passed arg, and
-- it's granted to `authenticated` (the worker calls it via their own session, not service-role). The
-- staff_payout_methods table has SELECT-only RLS, so writes go through this SECURITY DEFINER fn.
create or replace function add_payout_method(p_kind text, p_detail text, p_make_default boolean)
returns staff_payout_methods
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid    uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_role   text := current_app_role();
  v_first  boolean;
  v_row    staff_payout_methods;
begin
  if v_role not in ('staff', 'manager') then raise exception 'NOT_WORKER'; end if;
  if p_kind not in ('bank', 'paypal', 'wise') then raise exception 'INVALID_KIND'; end if;
  if coalesce(btrim(p_detail), '') = '' then raise exception 'INVALID_DETAIL'; end if;

  v_first := not exists (select 1 from staff_payout_methods where tenant_id = v_tenant and staff_id = v_pid);
  -- making this the default (explicitly, or because it's the worker's first method) clears the others
  if coalesce(p_make_default, false) or v_first then
    update staff_payout_methods set is_default = false where tenant_id = v_tenant and staff_id = v_pid;
  end if;

  insert into staff_payout_methods(tenant_id, staff_id, kind, detail, is_default)
       values (v_tenant, v_pid, p_kind, btrim(p_detail), coalesce(p_make_default, false) or v_first)
    returning * into v_row;
  return v_row;
end $$;

revoke execute on function add_payout_method(text, text, boolean) from public;
grant  execute on function add_payout_method(text, text, boolean) to authenticated;
