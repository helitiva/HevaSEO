-- inc-E31: pod managers join the order thread. A manager sees/posts on messages for orders assigned to
-- THEIR pod (the order's assignee has staff_details.manager_id = the manager). Managers are internal, so
-- they see internal + customer-facing. order_pod_manager() is SECURITY DEFINER because a manager can't
-- read the orders base table (money-blind) — the RLS subquery would otherwise return nothing.
create or replace function order_pod_manager(p_order uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select sd.manager_id from orders o join staff_details sd on sd.profile_id = o.assignee_id where o.id = p_order;
$$;

create policy order_messages_manager on order_messages
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'manager' and order_pod_manager(order_id) = current_profile_id());

-- add the manager branch to the participant check (assignee's pod manager may post).
create or replace function post_order_message(p_order uuid, p_body text, p_internal boolean default false)
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
          or (v_role = 'staff' and v_assignee = v_pid)
          or (v_role = 'manager' and v_pod_manager = v_pid)
          or (v_role = 'customer' and v_cust_user = v_pid)) then
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
