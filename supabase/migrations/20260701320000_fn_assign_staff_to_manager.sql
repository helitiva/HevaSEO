-- inc-E25: real pod assignment — set which manager owns a staff member (staff_details.manager_id, the
-- link post_staff_pay uses for the manager-override commission cascade). Admin-gated; p_manager null =
-- unassign. Validates both are the right role in the tenant. staff_details is written via this
-- SECURITY DEFINER fn (RLS-safe). Mirrors the assign_order pattern (Lane A).
create or replace function assign_staff_to_manager(p_staff uuid, p_manager uuid default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if not exists (select 1 from profiles where id = p_staff and tenant_id = v_tenant and role = 'staff') then
    raise exception 'NOT_STAFF';
  end if;
  if p_manager is not null
     and not exists (select 1 from profiles where id = p_manager and tenant_id = v_tenant and role = 'manager') then
    raise exception 'NOT_MANAGER';
  end if;

  update staff_details set manager_id = p_manager where profile_id = p_staff and tenant_id = v_tenant;
  if not found then raise exception 'STAFF_DETAILS_MISSING'; end if;

  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, case when p_manager is null then 'staff.unassigned' else 'staff.assigned' end, 'profile', p_staff);
end $$;

revoke execute on function assign_staff_to_manager(uuid, uuid) from public;
grant  execute on function assign_staff_to_manager(uuid, uuid) to authenticated;
