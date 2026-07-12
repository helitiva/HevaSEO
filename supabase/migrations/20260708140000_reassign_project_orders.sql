-- Reassign a customer's orders from one project to another (used when a project is deleted, so its orders
-- aren't orphaned off /projects by the ON DELETE SET NULL FK). order_details is otherwise update-locked
-- (authenticated has SELECT only, service_role has INSERT only), so this runs SECURITY DEFINER and is
-- ownership-checked: the caller must own both the source and destination project.
create or replace function reassign_project_orders(p_from uuid, p_to uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_pid    uuid := current_profile_id();
  v_n      integer;
begin
  if not exists (
    select 1 from projects pf join customers c on c.id = pf.customer_id
     where pf.id = p_from and pf.tenant_id = v_tenant and c.user_id = v_pid
  ) then raise exception 'NOT_YOUR_PROJECT'; end if;
  if p_to is not null and not exists (
    select 1 from projects pt join customers c on c.id = pt.customer_id
     where pt.id = p_to and pt.tenant_id = v_tenant and c.user_id = v_pid
  ) then raise exception 'NOT_YOUR_PROJECT'; end if;

  update order_details set project_id = p_to where project_id = p_from and tenant_id = v_tenant;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function reassign_project_orders(uuid, uuid) from public;
grant  execute on function reassign_project_orders(uuid, uuid) to authenticated;
