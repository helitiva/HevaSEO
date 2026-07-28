-- inc-E29: in-order task messages (was mock MESSAGES[orderId]). Order-scoped thread; `internal` = a
-- staff/admin-only note vs a customer-visible message. SELECT-only via RLS: admin (all), the assigned
-- staff (their order, incl. internal), the owning customer (NON-internal only). Posting goes through the
-- participant-gated SECURITY DEFINER fn (a customer's message is forced non-internal). Managers: pod
-- visibility is a follow-up.
create table order_messages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  order_id   uuid not null references orders(id) on delete cascade,
  author_id  uuid not null references profiles(id),
  body       text not null,
  internal   boolean not null default false,
  created_at timestamptz not null default now()
);
create index order_messages_order_idx on order_messages (order_id, created_at);

alter table order_messages enable row level security;
grant select on order_messages to authenticated;

create policy order_messages_admin on order_messages
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy order_messages_staff on order_messages
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'staff' and order_assignee_id(order_id) = current_profile_id());
create policy order_messages_customer on order_messages
  for select to authenticated
  using (
    tenant_id = current_tenant_id() and current_app_role() = 'customer' and internal = false
    and exists (select 1 from orders o join customers c on c.id = o.customer_id
                where o.id = order_messages.order_id and c.user_id = current_profile_id())
  );

-- a participant (admin / assigned staff / owning customer) posts a message. Customer → forced non-internal.
create or replace function post_order_message(p_order uuid, p_body text, p_internal boolean default false)
returns order_messages
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid       uuid := current_profile_id();
  v_role      text := current_app_role();
  v_tenant    uuid;
  v_assignee  uuid;
  v_cust_user uuid;
  v_internal  boolean;
  v_row       order_messages;
begin
  if p_body is null or length(btrim(p_body)) = 0 then raise exception 'EMPTY_MESSAGE'; end if;
  select o.tenant_id, o.assignee_id, c.user_id into v_tenant, v_assignee, v_cust_user
    from orders o left join customers c on c.id = o.customer_id where o.id = p_order;
  if v_tenant is null or v_tenant <> current_tenant_id() then raise exception 'ORDER_NOT_FOUND'; end if;

  if not (v_role = 'admin'
          or (v_role = 'staff' and v_assignee = v_pid)
          or (v_role = 'customer' and v_cust_user = v_pid)) then
    raise exception 'NOT_PARTICIPANT';
  end if;

  v_internal := case when v_role = 'customer' then false else coalesce(p_internal, false) end;
  insert into order_messages (tenant_id, order_id, author_id, body, internal)
       values (v_tenant, p_order, v_pid, btrim(p_body), v_internal)
    returning * into v_row;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'order.message', 'order', p_order);
  return v_row;
end $$;

revoke execute on function post_order_message(uuid, text, boolean) from public;
grant  execute on function post_order_message(uuid, text, boolean) to authenticated;
