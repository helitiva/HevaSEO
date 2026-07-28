-- Auto-approve stale deliveries: if a customer doesn't act on a DELIVERED order within a grace window
-- (default 7 days), the system approves it on their behalf (delivered → approved). Needs a delivered_at
-- timestamp to count from; advance_order stamps it whenever an order enters 'delivered'.

alter table orders add column if not exists delivered_at timestamptz;

-- advance_order: unchanged authz/transition rules; additionally stamps delivered_at on entry to
-- 'delivered' (a re-delivery after a revision restarts the countdown).
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

  -- ownership: a staffer acts only on their assigned order; a customer only on their own.
  if v_role = 'staff' and v_order.assignee_id is distinct from v_actor then
    raise exception 'NOT_YOUR_ORDER';
  end if;
  if v_role = 'customer' and not exists (
    select 1 from customers c where c.id = v_order.customer_id and c.user_id = v_actor
  ) then
    raise exception 'NOT_YOUR_ORDER';
  end if;

  update orders
     set state = p_to,
         delivered_at = case when p_to = 'delivered' then now() else delivered_at end
   where id = p_order returning * into v_order;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_order.tenant_id, v_actor, 'order.advanced', 'order', v_order.id,
               jsonb_build_object('from', v_from, 'to', p_to));
  return v_order;
end $$;

-- System job (service-role only): approve every delivered order whose grace window has elapsed. Runs
-- delivered → approved with a null actor (system) + an audit trail. Idempotent — only touches orders
-- still in 'delivered'. A scheduler (Vercel Cron / Supabase scheduled function) calls this daily via
-- /api/cron/auto-approve.
create or replace function auto_approve_stale_deliveries(p_grace_days int default 7)
returns int
language plpgsql security definer
set search_path = public
as $$
declare v_n int;
begin
  with moved as (
    update orders set state = 'approved'
     where state = 'delivered'
       and delivered_at is not null
       and delivered_at < now() - make_interval(days => greatest(p_grace_days, 0))
    returning id, tenant_id, delivered_at
  ), logged as (
    insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
    select tenant_id, null, 'order.auto_approved', 'order', id,
           jsonb_build_object('from', 'delivered', 'to', 'approved', 'reason', 'grace_elapsed',
                              'grace_days', p_grace_days, 'delivered_at', delivered_at)
    from moved
  )
  select count(*)::int into v_n from moved;
  return v_n;
end $$;

revoke execute on function auto_approve_stale_deliveries(int) from public;
revoke execute on function auto_approve_stale_deliveries(int) from anon, authenticated;
grant  execute on function auto_approve_stale_deliveries(int) to service_role;

-- backfill: currently-delivered orders start their countdown now (they had no timestamp before).
update orders set delivered_at = now() where state = 'delivered' and delivered_at is null;
