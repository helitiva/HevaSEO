-- Managers review their pod's deliverables (found by QA: /manager/review existed but managers could not
-- READ pod deliverables, could not call review_deliverable (admin-only), and internal_review→
-- delivered/changes_requested was admin-only in the state machine). Enable it, pod-scoped + money-blind.

-- 1) RLS: a manager may read deliverables whose order is assigned to one of their pod staff. Use the
-- SECURITY DEFINER helper order_pod_manager() — managers can't SELECT the base orders table (money-blind),
-- so a plain subquery over orders would return nothing.
create policy deliverables_manager_pod on deliverables
  for select to authenticated
  using (
    current_app_role() = 'manager'
    and order_pod_manager(order_id) = current_profile_id()
  );

-- 2) State machine: allow a manager to move internal_review → delivered / changes_requested.
insert into allowed_transitions(from_state, to_state, by_role) values
  ('internal_review', 'delivered',         'manager'),
  ('internal_review', 'changes_requested', 'manager')
on conflict do nothing;

-- 3) advance_order: a manager may only advance an order whose assignee is in their pod.
create or replace function advance_order(p_order uuid, p_to order_state)
returns orders
language plpgsql security definer
set search_path = public
as $$
declare
  v_order  orders;
  v_from   order_state;
  v_actor  uuid    := current_profile_id();
  v_tenant uuid    := current_tenant_id();
  v_role   app_role := nullif(current_app_role(), '')::app_role;
begin
  if v_actor is null or v_tenant is null or v_role is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_order from orders where id = p_order and tenant_id = v_tenant;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  v_from := v_order.state;

  if not exists (select 1 from allowed_transitions where from_state = v_from and to_state = p_to and by_role = v_role) then
    raise exception 'ILLEGAL_TRANSITION';
  end if;

  -- ownership: staff act only on their assigned order; a customer only on their own; a manager only on
  -- an order assigned to their pod.
  if v_role = 'staff' and v_order.assignee_id is distinct from v_actor then
    raise exception 'NOT_YOUR_ORDER';
  end if;
  if v_role = 'customer' and not exists (
    select 1 from customers c where c.id = v_order.customer_id and c.user_id = v_actor
  ) then
    raise exception 'NOT_YOUR_ORDER';
  end if;
  if v_role = 'manager' and not exists (
    select 1 from staff_details sd where sd.profile_id = v_order.assignee_id and sd.manager_id = v_actor
  ) then
    raise exception 'NOT_YOUR_POD';
  end if;

  update orders set state = p_to where id = p_order returning * into v_order;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_order.tenant_id, v_actor, 'order.advanced', 'order', v_order.id,
               jsonb_build_object('from', v_from, 'to', p_to));
  return v_order;
end $$;

-- 4) review_deliverable: admin (any) or the pod-manager of the deliverable's order assignee.
create or replace function review_deliverable(p_deliverable uuid, p_action text, p_note text default null)
returns deliverables
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant   uuid := current_tenant_id();
  v_actor    uuid := current_profile_id();
  v_role     text := current_app_role();
  v_status   deliverable_status;
  v_row      deliverables;
  v_assignee uuid;
begin
  if v_role not in ('admin', 'manager') then raise exception 'NOT_AUTHORIZED'; end if;
  v_status := case p_action when 'approve' then 'approved'
                            when 'request_changes' then 'changes_requested' end;
  if v_status is null then raise exception 'BAD_ACTION'; end if;

  select * into v_row from deliverables where id = p_deliverable and tenant_id = v_tenant for update;
  if not found then raise exception 'DELIVERABLE_NOT_FOUND'; end if;
  if v_row.status <> 'submitted' then raise exception 'ALREADY_REVIEWED'; end if;

  if v_role = 'manager' then
    select o.assignee_id into v_assignee from orders o where o.id = v_row.order_id;
    if not exists (select 1 from staff_details sd where sd.profile_id = v_assignee and sd.manager_id = v_actor) then
      raise exception 'NOT_YOUR_POD';
    end if;
  end if;

  update deliverables set status = v_status, reviewed_at = now(), review_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_deliverable returning * into v_row;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'deliverable.' || p_action, 'order', v_row.order_id);
  return v_row;
end $$;
