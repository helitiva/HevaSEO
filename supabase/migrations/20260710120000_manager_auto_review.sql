-- Manager "auto review". While a manager has it on, their pod's submissions skip the manual review queue:
-- the moment a staffer submits (order lands in internal_review) the deliverable is approved ON THE MANAGER'S
-- BEHALF and the order moves straight to 'delivered'. The resulting rows are identical to a hand-reviewed
-- delivery, so the customer still sees it as manager-reviewed — only the waiting is gone.
--
-- Mirrors the away/auto-assign toggle: a flag on profiles + a claims-derived setter + a self-read.

alter table profiles add column if not exists auto_review boolean not null default false;

-- Approve the pending submission + deliver, on behalf of the assignee's pod manager — but ONLY when that
-- manager has auto_review on and the order is actually sitting in internal_review. Returns the reviewing
-- manager, or null when it doesn't apply. Internal only: called by advance_order (a SECURITY DEFINER fn owned
-- by the same role), never granted to clients, so a staffer can't self-approve by calling it directly.
create or replace function auto_review_order(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tenant   uuid;
  v_assignee uuid;
  v_state    order_state;
  v_mgr      uuid;
begin
  select tenant_id, assignee_id, state into v_tenant, v_assignee, v_state
    from orders where id = p_order for update;
  if not found or v_state <> 'internal_review' or v_assignee is null then return null; end if;

  -- the pod manager of whoever did the work, and only if they've delegated review to the system
  select sd.manager_id into v_mgr
    from staff_details sd
    join profiles m on m.id = sd.manager_id
   where sd.profile_id = v_assignee and sd.tenant_id = v_tenant
     and m.role = 'manager' and m.auto_review;
  if v_mgr is null then return null; end if;

  -- standing approval: recorded in the manager's name so the delivery is indistinguishable from a manual one
  update deliverables set status = 'approved', reviewed_at = now()
   where order_id = p_order and status = 'submitted';
  update orders set state = 'delivered', delivered_at = now() where id = p_order;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_tenant, v_mgr, 'deliverable.approve', 'order', p_order,
               jsonb_build_object('auto_review', true));
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_tenant, v_mgr, 'order.advanced', 'order', p_order,
               jsonb_build_object('from', 'internal_review', 'to', 'delivered', 'auto_review', true));
  return v_mgr;
end $$;
revoke execute on function auto_review_order(uuid) from public;

-- advance_order: same transition/ownership rules, plus two changes —
--  (a) RESTORE the manager pod-ownership check. 20260702110000_manager_review added it; the later
--      20260702130000_auto_approve_deliveries redefined the fn without it, so managers could advance orders
--      outside their own pod. Re-asserted here.
--  (b) hand off to auto_review_order once an order lands in internal_review, so an auto-reviewing manager's
--      pod delivers straight through in the same transaction.
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
  if v_actor is null or v_tenant is null or v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_order from orders where id = p_order and tenant_id = v_tenant;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  v_from := v_order.state;

  if not exists (
    select 1 from allowed_transitions
     where from_state = v_from and to_state = p_to and by_role = v_role
  ) then
    raise exception 'ILLEGAL_TRANSITION';
  end if;

  -- ownership: a staffer acts only on their assigned order; a customer only on their own; a manager only on
  -- an order worked by their own pod.
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

  update orders
     set state = p_to,
         delivered_at = case when p_to = 'delivered' then now() else delivered_at end
   where id = p_order returning * into v_order;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_order.tenant_id, v_actor, 'order.advanced', 'order', v_order.id,
               jsonb_build_object('from', v_from, 'to', p_to));

  -- the pod manager may have delegated review to the system — if so this delivers it now
  if p_to = 'internal_review' and auto_review_order(p_order) is not null then
    select * into v_order from orders where id = p_order;   -- re-read: now 'delivered'
  end if;
  return v_order;
end $$;

-- The manager flips their own auto-review flag. Turning it ON also sweeps whatever is already waiting in
-- their review queue (same courtesy as the away toggle) and returns how many were delivered; OFF returns 0.
create or replace function set_auto_review(p_on boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_pid    uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_n      integer := 0;
  r        record;
begin
  if current_app_role() <> 'manager' then raise exception 'NOT_MANAGER'; end if;
  update profiles set auto_review = p_on where id = v_pid;
  if not p_on then return 0; end if;

  for r in
    select o.id from orders o
      join staff_details sd on sd.profile_id = o.assignee_id
     where o.tenant_id = v_tenant and o.state = 'internal_review' and sd.manager_id = v_pid
  loop
    if auto_review_order(r.id) is not null then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;
revoke execute on function set_auto_review(boolean) from public;
grant  execute on function set_auto_review(boolean) to authenticated;

-- The calling manager's current auto-review flag (JWT-derived self-read).
create or replace function my_auto_review()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select auto_review from profiles where id = current_profile_id()), false);
$$;
revoke execute on function my_auto_review() from public;
grant  execute on function my_auto_review() to authenticated;
