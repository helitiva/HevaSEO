-- Tickets + chat: the tables existed with SELECT-only RLS but no write path (support ran on mock).
-- Add SECURITY DEFINER fns so a customer opens a ticket + chats, and admin/assigned-staff reply.
-- Everything derives the actor/tenant from JWT claims and is participant-gated.

-- true if the caller may act on this ticket: admin, the owning customer, or the assigned staffer.
create or replace function ticket_participant(p_ticket uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from tickets t
    where t.id = p_ticket and t.tenant_id = current_tenant_id() and (
      current_app_role() = 'admin'
      or (current_app_role() = 'staff' and t.assignee_id = current_profile_id())
      or (current_app_role() = 'customer' and exists (
        select 1 from customers c where c.id = t.customer_id and c.user_id = current_profile_id()))
    )
  );
$$;

-- customer opens a ticket (+ the first message). type is the customer's category.
create or replace function create_ticket(p_subject text, p_type ticket_type, p_body text)
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
       values (v_tenant, v_code, p_subject, v_cust, p_type, 'portal', 'open', 'med', 'standard', now())
    returning * into v_ticket;
  if coalesce(btrim(p_body), '') <> '' then
    insert into ticket_messages(tenant_id, ticket_id, author_role, author_id, body)
         values (v_tenant, v_ticket.id, 'customer', v_prof, p_body);
  end if;
  return v_ticket;
end $$;

-- a participant posts a reply (customer → 'customer', admin/staff → 'staff' per the CHECK).
create or replace function post_ticket_message(p_ticket uuid, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_role text := case when current_app_role() = 'customer' then 'customer' else 'staff' end;
begin
  if coalesce(btrim(p_body), '') = '' then raise exception 'EMPTY_BODY'; end if;
  if not ticket_participant(p_ticket) then raise exception 'NOT_PARTICIPANT'; end if;
  insert into ticket_messages(tenant_id, ticket_id, author_role, author_id, body)
       values (current_tenant_id(), p_ticket, v_role, current_profile_id(), p_body);
  update tickets set last_reply_at = now(),
         status = case when current_app_role() = 'customer' and status = 'resolved' then 'open' else status end
   where id = p_ticket;
end $$;

-- a participant changes the ticket status (e.g. the customer closes it, support resolves it).
create or replace function set_ticket_status(p_ticket uuid, p_status ticket_status)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not ticket_participant(p_ticket) then raise exception 'NOT_PARTICIPANT'; end if;
  update tickets set status = p_status where id = p_ticket;
end $$;

revoke execute on function create_ticket(text, ticket_type, text) from public, anon;
revoke execute on function post_ticket_message(uuid, text) from public, anon;
revoke execute on function set_ticket_status(uuid, ticket_status) from public, anon;
grant  execute on function create_ticket(text, ticket_type, text) to authenticated;
grant  execute on function post_ticket_message(uuid, text) to authenticated;
grant  execute on function set_ticket_status(uuid, ticket_status) to authenticated;
