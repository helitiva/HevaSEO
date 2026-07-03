-- create_ticket ignored the priority the customer picked (hardcoded 'med'). Add a p_priority param so the
-- Support form's Low/Normal/Urgent selection is persisted. Replaces the 3-arg version.
drop function if exists create_ticket(text, ticket_type, text);

create or replace function create_ticket(p_subject text, p_type ticket_type, p_body text, p_priority order_priority default 'med')
returns tickets
language plpgsql security definer set search_path = public
as $$
declare
  v_ticket tickets;
  v_tenant uuid := current_tenant_id();
  v_prof   uuid := current_profile_id();
  v_cust   uuid;
  v_code   text := 'HV-' || lpad((floor(random() * 100000))::int::text, 5, '0');
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  select id into v_cust from customers where user_id = v_prof and tenant_id = v_tenant;
  if v_cust is null then raise exception 'NO_CUSTOMER'; end if;

  insert into tickets(tenant_id, code, subject, customer_id, type, channel, status, priority, sla_tier, last_reply_at)
       values (v_tenant, v_code, p_subject, v_cust, p_type, 'portal', 'open', coalesce(p_priority, 'med'), 'standard', now())
    returning * into v_ticket;
  if coalesce(btrim(p_body), '') <> '' then
    insert into ticket_messages(tenant_id, ticket_id, author_role, author_id, body)
         values (v_tenant, v_ticket.id, 'customer', v_prof, p_body);
  end if;
  return v_ticket;
end $$;

revoke execute on function create_ticket(text, ticket_type, text, order_priority) from public, anon;
grant  execute on function create_ticket(text, ticket_type, text, order_priority) to authenticated;
