-- create_order accepted p_value = 0, so a zero-value order was a free order.
--
-- The catalog ships packages priced 0 ('Ultra' and 'Custom' under Optimization carry price: 0 with
-- priceLabel: 'Consult'). The dashboard order action passed that straight through — it never checked
-- `hasNumericTotal` or the value, unlike the public checkout, which has refused both since it was
-- written. So a customer could pick a Consult package and land a real, unpaid order in the pipeline.
--
-- The action is fixed too (that's where the useful error message lives). This is the backstop: the
-- check belongs next to the money, so the next caller can't reopen the hole by forgetting it. Verified
-- safe against live data: 5 orders, min value $0.02 — a genuine $0 order has never existed, and
-- usage-priced services bill fractions, not nothing.
create or replace function create_order(
  p_tenant uuid, p_customer uuid, p_code text, p_service text, p_value numeric, p_actor uuid,
  p_deadline timestamptz default null
) returns orders
language plpgsql security definer
set search_path = public
as $$
declare
  v_order orders;
begin
  if p_value <= 0 then raise exception 'INVALID_AMOUNT'; end if;

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

-- unchanged from the hardening pass: service_role only, never reachable from a client
revoke execute on function create_order(uuid, uuid, text, text, numeric, uuid, timestamptz) from public, anon, authenticated;
grant  execute on function create_order(uuid, uuid, text, text, numeric, uuid, timestamptz) to service_role;
