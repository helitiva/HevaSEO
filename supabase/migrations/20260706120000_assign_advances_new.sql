-- Manager-assigned tasks never reached staff. create_order places orders in state 'new', but assign_order
-- only advanced 'confirmed' → 'assigned', so assigning a fresh order set the assignee yet left it 'new'.
-- The staff board only has columns for assigned/in_progress/internal_review/changes_requested/delivered,
-- so a 'new' order (no matching column) was invisible there. Advance BOTH 'new' and 'confirmed' → 'assigned'
-- on assign, so any unassigned order the manager routes shows up on the staffer's board immediately.
create or replace function assign_order(p_order uuid, p_staff uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant   uuid := current_tenant_id();
  v_actor    uuid := current_profile_id();
  v_role     text := current_app_role();
  v_state    order_state;
  v_assignee uuid;
begin
  if v_role not in ('admin', 'manager') then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists (select 1 from profiles where id = p_staff and tenant_id = v_tenant and role = 'staff')
    then raise exception 'NOT_STAFF'; end if;

  -- a manager may only assign TO a staffer in their own pod
  if v_role = 'manager' and not exists (
    select 1 from staff_details sd where sd.profile_id = p_staff and sd.manager_id = v_actor
  ) then raise exception 'NOT_YOUR_POD'; end if;

  select state, assignee_id into v_state, v_assignee from orders where id = p_order and tenant_id = v_tenant for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_state in ('delivered', 'completed', 'canceled') then raise exception 'ORDER_CLOSED'; end if;

  -- a manager may only (re)assign an order that is unassigned or already within their pod
  if v_role = 'manager' and v_assignee is not null and not exists (
    select 1 from staff_details sd where sd.profile_id = v_assignee and sd.manager_id = v_actor
  ) then raise exception 'NOT_YOUR_POD'; end if;

  update orders
     set assignee_id = p_staff,
         state = case when state in ('new', 'confirmed') then 'assigned'::order_state else state end
   where id = p_order and tenant_id = v_tenant;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'order.assign', 'order', p_order);
end $$;

revoke execute on function assign_order(uuid, uuid) from public;
grant  execute on function assign_order(uuid, uuid) to authenticated;
