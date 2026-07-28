-- ETA: persist an order deadline (derived from the chosen package SLA by the app) at creation, so the
-- dashboard can show a real "N days" turnaround. Both write paths (create_order = dashboard,
-- materialize_order = marketing quick-checkout) take an optional p_deadline. Service-role-only, as before.

-- create_order: add p_deadline (drop the old 6-arg signature first so there's a single function).
drop function if exists create_order(uuid, uuid, text, text, numeric, uuid);
create function create_order(
  p_tenant uuid, p_customer uuid, p_code text, p_service text, p_value numeric, p_actor uuid,
  p_deadline timestamptz default null
) returns orders
language plpgsql security definer
set search_path = public
as $$
declare v_order orders;
begin
  if p_value < 0 then raise exception 'INVALID_AMOUNT'; end if;
  update customer_balances
     set balance = balance - p_value, updated_at = now()
   where customer_id = p_customer and tenant_id = p_tenant and balance >= p_value;
  if not found then raise exception 'INSUFFICIENT_CREDIT'; end if;
  insert into orders(tenant_id, code, customer_id, service, value, state, deadline)
       values (p_tenant, p_code, p_customer, p_service, p_value, 'new', p_deadline)
    returning * into v_order;
  insert into credit_ledger(tenant_id, customer_id, amount, kind, order_id)
       values (p_tenant, p_customer, -p_value, 'debit', v_order.id);
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (p_tenant, p_actor, 'order.created', 'order', v_order.id);
  return v_order;
end $$;
revoke execute on function create_order(uuid, uuid, text, text, numeric, uuid, timestamptz) from public;
revoke execute on function create_order(uuid, uuid, text, text, numeric, uuid, timestamptz) from anon, authenticated;
grant  execute on function create_order(uuid, uuid, text, text, numeric, uuid, timestamptz) to service_role;

-- materialize_order: add p_deadline (drop old 7-arg signature first).
drop function if exists materialize_order(uuid, uuid, text, text, numeric, uuid, text);
create function materialize_order(
  p_tenant uuid, p_customer uuid, p_code text, p_service text, p_value numeric, p_actor uuid, p_ref text,
  p_deadline timestamptz default null
) returns orders
language plpgsql security definer
set search_path = public
as $$
declare v_order orders;
begin
  if p_value < 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into v_order from orders where tenant_id = p_tenant and checkout_ref = p_ref;
  if found then return v_order; end if;
  insert into customer_balances(customer_id, tenant_id, balance)
       values (p_customer, p_tenant, p_value)
  on conflict (customer_id) do update
       set balance = customer_balances.balance + p_value, updated_at = now();
  insert into credit_ledger(tenant_id, customer_id, amount, kind, stripe_event_id)
       values (p_tenant, p_customer, p_value, 'topup', p_ref);
  insert into orders(tenant_id, code, customer_id, service, value, state, source, checkout_ref, deadline)
       values (p_tenant, p_code, p_customer, p_service, p_value, 'new', 'quick', p_ref, p_deadline)
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
revoke execute on function materialize_order(uuid, uuid, text, text, numeric, uuid, text, timestamptz) from public;
revoke execute on function materialize_order(uuid, uuid, text, text, numeric, uuid, text, timestamptz) from anon, authenticated;
grant  execute on function materialize_order(uuid, uuid, text, text, numeric, uuid, text, timestamptz) to service_role;
