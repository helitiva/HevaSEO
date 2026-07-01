-- Lane A cleanup: admin assigns an order to a staff member. Sets orders.assignee_id and, when the order
-- is still 'confirmed', advances it to 'assigned' (the confirmed→assigned step). Reassigning a later-stage
-- order just swaps the assignee (keeps its state). Admin-gated + claims-derived tenant (orders base RLS
-- doesn't grant admin an UPDATE path, and money-blind roles can't write) — so writes go through this fn.
create or replace function assign_order(p_order uuid, p_staff uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
  v_state  order_state;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if not exists (select 1 from profiles where id = p_staff and tenant_id = v_tenant and role = 'staff')
    then raise exception 'NOT_STAFF'; end if;

  select state into v_state from orders where id = p_order and tenant_id = v_tenant for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_state in ('delivered', 'completed', 'canceled') then raise exception 'ORDER_CLOSED'; end if;

  update orders
     set assignee_id = p_staff,
         state = case when state = 'confirmed' then 'assigned'::order_state else state end
   where id = p_order and tenant_id = v_tenant;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'order.assign', 'order', p_order);
end $$;

revoke execute on function assign_order(uuid, uuid) from public;
grant  execute on function assign_order(uuid, uuid) to authenticated;
