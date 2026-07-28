-- Step 2 / inc-5a: order_details — 1:1 side table for an order's non-money extras (the brief the
-- customer submitted, the project/folder it belongs to, what the package includes). Replaces the
-- mock ORDER_EXTRA. NON-money on purpose: addons carry prices, so they're deferred to a later slice
-- with a money-stripped view (like orders/orders_mgr). Visible to anyone who can see the order:
-- admin (tenant), manager (tenant — these fields aren't money), the owning customer, the assigned staff.
create table order_details (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  order_id   uuid not null unique references orders(id) on delete cascade,
  project    text,
  folder     text,
  brief      jsonb not null default '[]',   -- [{label, value, full?}] — the order-time brief
  included   text[] not null default '{}',  -- what the chosen package covers
  created_at timestamptz not null default now()
);
create index order_details_tenant_idx on order_details (tenant_id);

alter table order_details enable row level security;
grant select on order_details to authenticated;

-- ops see the whole tenant (these fields carry no money)
create policy order_details_admin on order_details
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy order_details_manager on order_details
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'manager');

-- the owning customer sees their order's brief
create policy order_details_customer on order_details
  for select to authenticated
  using (
    current_app_role() = 'customer'
    and exists (
      select 1 from orders o join customers c on c.id = o.customer_id
      where o.id = order_details.order_id and c.user_id = current_profile_id()
    )
  );

-- the assigned staffer sees the brief for the order they work. A staff member has NO RLS read on the
-- orders base table (money-blind), so the assignment check must bypass RLS via a SECURITY DEFINER
-- lookup — otherwise the subquery sees 0 orders and the policy never matches.
create or replace function order_assignee_id(p_order uuid) returns uuid
  language sql security definer stable set search_path = public
  as $$ select assignee_id from orders where id = p_order $$;

create policy order_details_staff on order_details
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'staff'
    and order_assignee_id(order_details.order_id) = current_profile_id()
  );
