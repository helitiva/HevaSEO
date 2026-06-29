-- E0b increment 3: orders spine — the central workflow entity.
-- order_state is a Postgres enum (ADR C3: type-safe, not workflow-as-data); transitions
-- are a simple data table (from→to by role) the advance_order function will consult (E0d).

create type order_state as enum (
  'new', 'confirmed', 'assigned', 'in_progress', 'internal_review',
  'delivered', 'changes_requested', 'approved', 'completed', 'canceled'
);
create type order_priority as enum ('low', 'med', 'high');
create type order_source   as enum ('quick', 'dashboard');

create table orders (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  code        text not null,
  customer_id uuid not null references customers(id) on delete cascade,
  service     text not null,                 -- → catalog_services FK when catalog lands
  pkg         text,
  state       order_state not null default 'new',
  priority    order_priority not null default 'med',
  source      order_source not null default 'dashboard',
  value       numeric(12,2) not null default 0,   -- MONEY: column-level hiding for staff/manager
                                                   -- is gated (money-stripped views, ADR K9)
  assignee_id uuid references profiles(id),         -- staff assigned (null until assigned)
  deadline    timestamptz,
  created_at  timestamptz not null default now()
);
create index orders_tenant_idx   on orders (tenant_id);
create index orders_customer_idx on orders (customer_id);
create index orders_assignee_idx on orders (assignee_id);
create index orders_state_idx    on orders (tenant_id, state);
create unique index orders_code_idx on orders (tenant_id, code);

-- Allowed workflow transitions (ADR C3). Seeded with HevaSEO's pipeline; advance_order (E0d) validates against this.
create table allowed_transitions (
  from_state order_state not null,
  to_state   order_state not null,
  by_role    app_role not null,
  primary key (from_state, to_state, by_role)
);
insert into allowed_transitions(from_state, to_state, by_role) values
  ('new',               'confirmed',         'admin'),
  ('confirmed',         'assigned',          'admin'),
  ('assigned',          'in_progress',       'staff'),
  ('in_progress',       'internal_review',   'staff'),
  ('internal_review',   'delivered',         'admin'),
  ('internal_review',   'changes_requested', 'admin'),
  ('changes_requested', 'in_progress',       'staff'),
  ('delivered',         'approved',          'customer'),
  ('delivered',         'changes_requested', 'customer'),
  ('approved',          'completed',         'admin'),
  ('new',               'canceled',          'admin'),
  ('confirmed',         'canceled',          'admin'),
  ('assigned',          'canceled',          'admin');

alter table orders enable row level security;
grant select on orders to authenticated;

-- ROW-level visibility now. NOTE: column-level money-blindness for staff/manager (hiding `value`)
-- is gated — they read via money-stripped views (orders_mgr/orders_staff, ADR K9), built at the
-- money increment. Until then staff/manager have NO base-table policy here (they see 0 orders),
-- which keeps `value` from ever leaking. admin + customer (who may see their own price) work now.
create policy orders_admin_all on orders
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create policy orders_customer_own on orders
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and exists (
      select 1 from customers c
      where c.id = orders.customer_id
        and c.user_id = current_profile_id()
    )
  );
