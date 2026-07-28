-- E0b increment: tickets + ticket_messages (customer support surface). Non-money — fully tenant+role RLS.
-- A ticket may optionally reference an order; a customer owns tickets via their customers row,
-- a staff handler owns tickets via assignee_id. Messages inherit their parent ticket's visibility.

create type ticket_type    as enum ('technical', 'billing', 'consultation');
create type ticket_channel as enum ('portal', 'whatsapp', 'messenger', 'email');
create type ticket_status  as enum ('open', 'pending', 'resolved', 'closed');
create type sla_tier       as enum ('urgent', 'standard');

create table tickets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  code          text not null,
  subject       text not null,
  customer_id   uuid references customers(id) on delete cascade,   -- null for internal/unlinked tickets
  type          ticket_type not null,
  channel       ticket_channel not null default 'portal',
  status        ticket_status not null default 'open',
  priority      order_priority not null default 'med',
  assignee_id   uuid references profiles(id),                      -- staff handler; null until assigned
  sla_tier      sla_tier not null default 'standard',
  order_id      uuid references orders(id),                        -- optional link to an order
  created_at    timestamptz not null default now(),
  last_reply_at timestamptz
);
create index tickets_tenant_idx   on tickets (tenant_id);
create index tickets_customer_idx on tickets (customer_id);
create index tickets_assignee_idx on tickets (assignee_id);

create table ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  ticket_id   uuid not null references tickets(id) on delete cascade,
  author_role text not null check (author_role in ('customer', 'staff')),
  author_id   uuid references profiles(id),                        -- null for system/unattributed
  body        text not null,
  created_at  timestamptz not null default now()
);
create index ticket_messages_tenant_idx on ticket_messages (tenant_id);
create index ticket_messages_ticket_idx on ticket_messages (ticket_id);

alter table tickets         enable row level security;
alter table ticket_messages enable row level security;
grant select on tickets, ticket_messages to authenticated;

-- tickets: admin sees tenant; customer sees tickets on their own customer record;
-- staff sees tickets assigned to them.
create policy tickets_admin_all on tickets
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create policy tickets_customer_own on tickets
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and exists (
      select 1 from customers c
      where c.id = tickets.customer_id
        and c.user_id = current_profile_id()
    )
  );

create policy tickets_staff_assigned on tickets
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'staff'
    and assignee_id = current_profile_id()
  );

-- ticket_messages: mirror the parent ticket's visibility exactly (admin / customer-owns / staff-assigned).
create policy ticket_messages_admin_all on ticket_messages
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create policy ticket_messages_customer_own on ticket_messages
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and exists (
      select 1 from tickets t
      join customers c on c.id = t.customer_id
      where t.id = ticket_messages.ticket_id
        and c.user_id = current_profile_id()
    )
  );

create policy ticket_messages_staff_assigned on ticket_messages
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'staff'
    and exists (
      select 1 from tickets t
      where t.id = ticket_messages.ticket_id
        and t.assignee_id = current_profile_id()
    )
  );
