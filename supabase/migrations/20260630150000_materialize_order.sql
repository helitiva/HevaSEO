-- Phase 2 / inc-Q1: quick-checkout core (ADR §7, 6 chốt). materialize_order = the ATOMIC money step
-- (chốt H2): topup the exact order value + create the order + debit it, ALL in one transaction, so we
-- can never sell credit without an order. Idempotent by checkout_ref (chốt 3) so a retried/duplicated
-- payment yields the same order, not a second one. service-role-only (the public checkout route handler
-- calls it after the payment provider — mock/Stripe — confirms; client value is never trusted, chốt 1).

-- idempotency key: the payment reference, stamped on the order it created.
alter table orders add column if not exists checkout_ref text;
create unique index if not exists orders_checkout_ref_uk
  on orders (tenant_id, checkout_ref) where checkout_ref is not null;

create or replace function materialize_order(
  p_tenant uuid, p_customer uuid, p_code text, p_service text, p_value numeric, p_actor uuid, p_ref text
) returns orders
language plpgsql security definer
set search_path = public
as $$
declare v_order orders;
begin
  if p_value < 0 then raise exception 'INVALID_AMOUNT'; end if;

  -- (chốt 3) idempotency: this payment was already materialized → return the same order, no double-charge.
  select * into v_order from orders where tenant_id = p_tenant and checkout_ref = p_ref;
  if found then return v_order; end if;

  -- (chốt H2) atomic: credit the exact value, then spend it on the order — one txn. Balance nets to 0
  -- for this purchase; the ledger shows the topup (+) and the order debit (−).
  insert into customer_balances(customer_id, tenant_id, balance)
       values (p_customer, p_tenant, p_value)
  on conflict (customer_id) do update
       set balance = customer_balances.balance + p_value, updated_at = now();
  insert into credit_ledger(tenant_id, customer_id, amount, kind, stripe_event_id)
       values (p_tenant, p_customer, p_value, 'topup', p_ref);
  insert into orders(tenant_id, code, customer_id, service, value, state, source, checkout_ref)
       values (p_tenant, p_code, p_customer, p_service, p_value, 'new', 'quick', p_ref)
    returning * into v_order;
  update customer_balances
     set balance = balance - p_value, updated_at = now()
   where customer_id = p_customer and tenant_id = p_tenant;
  insert into credit_ledger(tenant_id, customer_id, amount, kind, order_id)
       values (p_tenant, p_customer, -p_value, 'debit', v_order.id);
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (p_tenant, p_actor, 'order.quick_checkout', 'order', v_order.id);
  return v_order;
end $$;

-- service-role-only: same hardening as create_order/topup (client-untrusted value).
revoke execute on function materialize_order(uuid, uuid, text, text, numeric, uuid, text) from public;
grant  execute on function materialize_order(uuid, uuid, text, text, numeric, uuid, text) to service_role;
