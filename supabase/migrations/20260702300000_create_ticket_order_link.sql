-- Link a support ticket to the "Related service" (a real order the customer picked). create_ticket gains
-- p_order_code; it resolves to the caller's OWN order id and sets tickets.order_id (the column already
-- exists). Empty/unknown code → no link. Replaces the 4-arg version.
drop function if exists create_ticket(text, ticket_type, text, order_priority);

create or replace function create_ticket(
  p_subject text, p_type ticket_type, p_body text,
  p_priority order_priority default 'med', p_order_code text default null
) returns tickets
language plpgsql security definer set search_path = public
as $$
declare
  v_ticket tickets;
  v_tenant uuid := current_tenant_id();
  v_prof   uuid := current_profile_id();
  v_cust   uuid;
  v_order  uuid;
  v_code   text := 'HV-' || lpad((floor(random() * 100000))::int::text, 5, '0');
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  select id into v_cust from customers where user_id = v_prof and tenant_id = v_tenant;
  if v_cust is null then raise exception 'NO_CUSTOMER'; end if;
  -- resolve the related-order link, scoped to the caller's own orders (ignored if blank/unknown)
  if coalesce(btrim(p_order_code), '') <> '' then
    select id into v_order from orders where code = p_order_code and customer_id = v_cust and tenant_id = v_tenant;
  end if;

  insert into tickets(tenant_id, code, subject, customer_id, type, channel, status, priority, sla_tier, order_id, last_reply_at)
       values (v_tenant, v_code, p_subject, v_cust, p_type, 'portal', 'open', coalesce(p_priority, 'med'), 'standard', v_order, now())
    returning * into v_ticket;
  if coalesce(btrim(p_body), '') <> '' then
    insert into ticket_messages(tenant_id, ticket_id, author_role, author_id, body)
         values (v_tenant, v_ticket.id, 'customer', v_prof, p_body);
  end if;
  return v_ticket;
end $$;
revoke execute on function create_ticket(text, ticket_type, text, order_priority, text) from public, anon;
grant  execute on function create_ticket(text, ticket_type, text, order_priority, text) to authenticated;
