-- E0d increment 1: atomic money functions (ADR K2/K3/D13). SECURITY DEFINER so the app never
-- UPDATEs balance/status directly — RLS blocks that; only these functions may move money.
-- create_order does the debit + guard in ONE statement (UPDATE ... WHERE balance >= price), which
-- locks the row and checks credit at once → no race, no advisory lock, no SUM(ledger).

-- topup: add credit (Stripe top-up or admin grant). Idempotent per stripe_event_id (partial unique
-- index already enforces it; a duplicate event raises unique_violation, caught by the caller).
create or replace function topup(
  p_tenant uuid, p_customer uuid, p_amount numeric, p_actor uuid, p_stripe text default null
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  insert into customer_balances(customer_id, tenant_id, balance)
       values (p_customer, p_tenant, p_amount)
  on conflict (customer_id) do update
       set balance = customer_balances.balance + p_amount, updated_at = now();
  insert into credit_ledger(tenant_id, customer_id, amount, kind, stripe_event_id)
       values (p_tenant, p_customer, p_amount, 'topup', p_stripe);
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (p_tenant, p_actor, 'credit.topup', 'customer', p_customer);
end $$;

-- create_order: atomic debit (balance >= price guard) + order + ledger + audit, all in one txn.
create or replace function create_order(
  p_tenant uuid, p_customer uuid, p_code text, p_service text, p_value numeric, p_actor uuid
) returns orders
language plpgsql security definer
set search_path = public
as $$
declare v_order orders;
begin
  if p_value < 0 then raise exception 'INVALID_AMOUNT'; end if;
  -- Atomic: locks the balance row AND checks sufficiency in a single statement.
  update customer_balances
     set balance = balance - p_value, updated_at = now()
   where customer_id = p_customer and tenant_id = p_tenant and balance >= p_value;
  if not found then
    raise exception 'INSUFFICIENT_CREDIT';
  end if;
  insert into orders(tenant_id, code, customer_id, service, value, state)
       values (p_tenant, p_code, p_customer, p_service, p_value, 'new')
    returning * into v_order;
  insert into credit_ledger(tenant_id, customer_id, amount, kind, order_id)
       values (p_tenant, p_customer, -p_value, 'debit', v_order.id);
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (p_tenant, p_actor, 'order.created', 'order', v_order.id);
  return v_order;
end $$;
