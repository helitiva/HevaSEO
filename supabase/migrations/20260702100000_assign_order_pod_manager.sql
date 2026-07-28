-- Managers route their own pod (found by QA: the manager Assignment surface was designed to route work,
-- but assign_order was admin-only, so managers could never actually assign). Widen it: a manager may
-- assign an order that is UNASSIGNED or already within their pod, and only to a staffer in their pod
-- (staff_details.manager_id = the manager). Admin behaviour is unchanged (any order, any staff).
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
         state = case when state = 'confirmed' then 'assigned'::order_state else state end
   where id = p_order and tenant_id = v_tenant;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'order.assign', 'order', p_order);
end $$;

revoke execute on function assign_order(uuid, uuid) from public;
grant  execute on function assign_order(uuid, uuid) to authenticated;
