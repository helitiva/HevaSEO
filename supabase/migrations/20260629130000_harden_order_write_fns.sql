-- Lane A inc-4 prep — SECURITY hardening of the E0d order write functions (gác③).
--
-- Finding: advance_order/cancel_order trusted caller-passed p_actor/p_actor_role and had no
-- `revoke execute`, so any authenticated user could call them via PostgREST rpc() and forge
-- p_actor_role='admin' to drive the order state machine / cancel_order (which REFUNDS money).
-- Proven: a customer forging role=admin was NOT stopped by the role gate.
--
-- Fix:
--  (1) advance_order/cancel_order derive identity from the JWT claims the Auth hook injects
--      (current_profile_id / current_app_role / current_tenant_id) instead of parameters, and add
--      per-role ownership authorization. They self-enforce regardless of caller, so they stay
--      callable by `authenticated` (server actions use the user's JWT) but not `anon`.
--  (2) create_order/topup take value/amount params that must NOT be client-trusted (no catalog
--      pricing yet) → execute revoked from anon+authenticated; only service_role (server actions /
--      Stripe webhook) may call them, with a server-computed price.
-- The old vulnerable signatures are DROPPED (not just replaced) so no exploitable overload lingers.

drop function if exists advance_order(uuid, order_state, uuid, app_role);
drop function if exists cancel_order(uuid, uuid);

-- advance_order: actor/role/tenant from claims; transition gated by allowed_transitions for the
-- caller's REAL role; staff may only advance their own assigned order, a customer only their own.
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

  update orders set state = p_to where id = p_order returning * into v_order;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_order.tenant_id, v_actor, 'order.advanced', 'order', v_order.id,
               jsonb_build_object('from', v_from, 'to', p_to));
  return v_order;
end $$;

-- cancel_order: actor/role/tenant from claims. Only an admin or the OWNING customer may cancel, and
-- only while still planned (new|confirmed|assigned). Refund value − 5% fee to dashboard credit.
create or replace function cancel_order(p_order uuid)
returns orders
language plpgsql security definer
set search_path = public
as $$
declare
  v_order  orders;
  v_fee    numeric;
  v_actor  uuid    := current_profile_id();
  v_tenant uuid    := current_tenant_id();
  v_role   app_role := nullif(current_app_role(), '')::app_role;
begin
  if v_actor is null or v_tenant is null or v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_order from orders where id = p_order and tenant_id = v_tenant;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  -- authorization: admin (any order in tenant) or the owning customer; nobody else.
  if v_role = 'customer' then
    if not exists (select 1 from customers c where c.id = v_order.customer_id and c.user_id = v_actor) then
      raise exception 'NOT_AUTHORIZED';
    end if;
  elsif v_role <> 'admin' then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_order.state not in ('new', 'confirmed', 'assigned') then
    raise exception 'NOT_CANCELABLE';
  end if;

  v_fee := round(v_order.value * cancel_fee_pct(), 2);
  update customer_balances
     set balance = balance + v_order.value, updated_at = now()
   where customer_id = v_order.customer_id and tenant_id = v_order.tenant_id;
  insert into credit_ledger(tenant_id, customer_id, amount, kind, order_id)
       values (v_order.tenant_id, v_order.customer_id, v_order.value, 'refund', v_order.id);
  if v_fee > 0 then
    update customer_balances
       set balance = balance - v_fee, updated_at = now()
     where customer_id = v_order.customer_id and tenant_id = v_order.tenant_id;
    insert into credit_ledger(tenant_id, customer_id, amount, kind, order_id)
         values (v_order.tenant_id, v_order.customer_id, -v_fee, 'cancel_fee', v_order.id);
  end if;
  update orders set state = 'canceled' where id = p_order returning * into v_order;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_order.tenant_id, v_actor, 'order.canceled', 'order', v_order.id,
               jsonb_build_object('refund', v_order.value, 'cancel_fee', v_fee));
  return v_order;
end $$;

-- Execute grants: advance/cancel self-enforce via claims → authenticated may call (server actions
-- use the user's JWT), anon may not. create_order/topup carry client-untrusted value/amount → only
-- service_role (server-side, server-computed price) may call them.
revoke execute on function advance_order(uuid, order_state) from public;
revoke execute on function cancel_order(uuid)               from public;
grant  execute on function advance_order(uuid, order_state) to authenticated;
grant  execute on function cancel_order(uuid)               to authenticated;

revoke execute on function create_order(uuid, uuid, text, text, numeric, uuid) from public;
revoke execute on function topup(uuid, uuid, numeric, uuid, text)              from public;
grant  execute on function create_order(uuid, uuid, text, text, numeric, uuid) to service_role;
grant  execute on function topup(uuid, uuid, numeric, uuid, text)              to service_role;
