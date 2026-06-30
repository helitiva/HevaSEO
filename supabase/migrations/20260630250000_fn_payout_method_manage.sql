-- Lane D polish: a worker manages their OWN payout methods — set-default + remove. Same claims-derived
-- pattern as add_payout_method (identity from JWT, own rows only, granted authenticated; the table is
-- SELECT-only via RLS so writes go through these SECURITY DEFINER fns). Keeps "exactly one default".

create or replace function set_default_payout_method(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid    uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_role   text := current_app_role();
begin
  if v_role not in ('staff', 'manager') then raise exception 'NOT_WORKER'; end if;
  if not exists (select 1 from staff_payout_methods where id = p_id and tenant_id = v_tenant and staff_id = v_pid)
    then raise exception 'METHOD_NOT_FOUND'; end if;
  update staff_payout_methods set is_default = (id = p_id) where tenant_id = v_tenant and staff_id = v_pid;
end $$;

create or replace function remove_payout_method(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid     uuid := current_profile_id();
  v_tenant  uuid := current_tenant_id();
  v_role    text := current_app_role();
  v_was_def boolean;
  v_next    uuid;
begin
  if v_role not in ('staff', 'manager') then raise exception 'NOT_WORKER'; end if;
  delete from staff_payout_methods
   where id = p_id and tenant_id = v_tenant and staff_id = v_pid
   returning is_default into v_was_def;
  if not found then raise exception 'METHOD_NOT_FOUND'; end if;
  -- removing the default promotes the next remaining method so a worker is never left with zero default
  if v_was_def then
    select id into v_next from staff_payout_methods
      where tenant_id = v_tenant and staff_id = v_pid order by created_at limit 1;
    if v_next is not null then update staff_payout_methods set is_default = true where id = v_next; end if;
  end if;
end $$;

revoke execute on function set_default_payout_method(uuid) from public;
revoke execute on function remove_payout_method(uuid) from public;
grant  execute on function set_default_payout_method(uuid) to authenticated;
grant  execute on function remove_payout_method(uuid) to authenticated;
