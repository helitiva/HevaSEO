-- E0d increment 2: advance_order (state machine) + cancel_order (refund).
-- Both SECURITY DEFINER: the app never UPDATEs orders.state directly — it calls these, which
-- validate against allowed_transitions (advance) or refund credit atomically (cancel).

-- advance_order: move an order to a new state ONLY if (from,to,role) is an allowed transition.
create or replace function advance_order(
  p_order uuid, p_to order_state, p_actor uuid, p_actor_role app_role
) returns orders
language plpgsql security definer
set search_path = public
as $$
declare v_order orders; v_from order_state;
begin
  select * into v_order from orders where id = p_order;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  v_from := v_order.state;
  if not exists (
    select 1 from allowed_transitions
     where from_state = v_from and to_state = p_to and by_role = p_actor_role
  ) then
    raise exception 'ILLEGAL_TRANSITION';
  end if;
  update orders set state = p_to where id = p_order returning * into v_order;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_order.tenant_id, p_actor, 'order.advanced', 'order', v_order.id,
               jsonb_build_object('from', v_from, 'to', p_to));
  return v_order;
end $$;

-- A cancellation keeps a 5% fee (anti-spam) — record it as its own ledger kind.
alter table credit_ledger drop constraint credit_ledger_kind_check;
alter table credit_ledger add constraint credit_ledger_kind_check
  check (kind in ('topup', 'debit', 'refund', 'cancel_fee'));

-- Cancellation fee, percent of order value (business policy: anti-spam). Single source.
create or replace function cancel_fee_pct() returns numeric language sql immutable as $$ select 0.05 $$;

-- cancel_order: allowed ONLY before the staff accepts the work — i.e. while the order is still
-- "planned" (new | confirmed | assigned). Once it is in_progress ("processing") or beyond, it cannot
-- be canceled. The refund goes back as DASHBOARD CREDIT (the general policy, incl. quick-buy
-- customers — never a card refund), minus a 5% cancellation fee. Refund + fee keep balance==SUM(ledger).
create or replace function cancel_order(
  p_order uuid, p_actor uuid
) returns orders
language plpgsql security definer
set search_path = public
as $$
declare v_order orders; v_fee numeric;
begin
  select * into v_order from orders where id = p_order;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  -- "planned" = staff has not accepted yet. Anything from in_progress onward is locked.
  if v_order.state not in ('new', 'confirmed', 'assigned') then
    raise exception 'NOT_CANCELABLE';
  end if;
  v_fee := round(v_order.value * cancel_fee_pct(), 2);
  -- full refund of the debited value back to the customer's dashboard credit...
  update customer_balances
     set balance = balance + v_order.value, updated_at = now()
   where customer_id = v_order.customer_id and tenant_id = v_order.tenant_id;
  insert into credit_ledger(tenant_id, customer_id, amount, kind, order_id)
       values (v_order.tenant_id, v_order.customer_id, v_order.value, 'refund', v_order.id);
  -- ...then withhold the 5% cancellation fee (anti-spam) if any.
  if v_fee > 0 then
    update customer_balances
       set balance = balance - v_fee, updated_at = now()
     where customer_id = v_order.customer_id and tenant_id = v_order.tenant_id;
    insert into credit_ledger(tenant_id, customer_id, amount, kind, order_id)
         values (v_order.tenant_id, v_order.customer_id, -v_fee, 'cancel_fee', v_order.id);
  end if;
  update orders set state = 'canceled' where id = p_order returning * into v_order;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_order.tenant_id, p_actor, 'order.canceled', 'order', v_order.id,
               jsonb_build_object('refund', v_order.value, 'cancel_fee', v_fee));
  return v_order;
end $$;
