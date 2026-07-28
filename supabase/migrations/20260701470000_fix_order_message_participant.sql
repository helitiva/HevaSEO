-- SECURITY (found by live E2E) — fix a NULL-logic authorization leak in post_order_message's
-- participant gate. The check `v_cust_user = v_pid` (and the staff/manager equivalents) evaluates to
-- NULL when the compared column is NULL — e.g. an order owned by an unclaimed SHADOW customer
-- (customers.user_id IS NULL) or an UNASSIGNED order (orders.assignee_id IS NULL). `if not (… or NULL)`
-- is `if NULL`, which does NOT raise — so any authenticated customer could post a message on a
-- shadow-customer's order (and any staffer on an unassigned order). Wrap each comparison in
-- coalesce(… , false) so a NULL never satisfies the gate. Behaviour for real matches is unchanged.
create or replace function public.post_order_message(p_order uuid, p_body text, p_internal boolean default false)
returns order_messages
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid         uuid := current_profile_id();
  v_role        text := current_app_role();
  v_tenant      uuid;
  v_assignee    uuid;
  v_cust_user   uuid;
  v_pod_manager uuid;
  v_internal    boolean;
  v_row         order_messages;
begin
  if p_body is null or length(btrim(p_body)) = 0 then raise exception 'EMPTY_MESSAGE'; end if;
  select o.tenant_id, o.assignee_id, c.user_id, sd.manager_id
    into v_tenant, v_assignee, v_cust_user, v_pod_manager
    from orders o
    left join customers c on c.id = o.customer_id
    left join staff_details sd on sd.profile_id = o.assignee_id
   where o.id = p_order;
  if v_tenant is null or v_tenant <> current_tenant_id() then raise exception 'ORDER_NOT_FOUND'; end if;

  if not (v_role = 'admin'
          or (v_role = 'staff'    and coalesce(v_assignee    = v_pid, false))
          or (v_role = 'manager'  and coalesce(v_pod_manager = v_pid, false))
          or (v_role = 'customer' and coalesce(v_cust_user   = v_pid, false))) then
    raise exception 'NOT_PARTICIPANT';
  end if;

  v_internal := case when v_role = 'customer' then false else coalesce(p_internal, false) end;
  insert into order_messages (tenant_id, order_id, author_id, body, internal)
       values (v_tenant, p_order, v_pid, btrim(p_body), v_internal)
    returning * into v_row;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'order.message', 'order', p_order);
  return v_row;
end $$;
