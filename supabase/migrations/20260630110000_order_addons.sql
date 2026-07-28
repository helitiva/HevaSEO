-- Step 2 / inc-5c: order_addons — the paid upsells on an order (name, tier, PRICE). MONEY, so this is
-- the money-blind boundary: only admin (tenant) and the owning customer may read it. Managers/staff
-- get NO policy → 0 rows → the order-detail upsell block (which renders prices) simply doesn't show
-- for them. Same money-blind principle as orders/orders_mgr, achieved by withholding rows rather than
-- a stripped view (the addon list is money-only info, of no use without prices).
create table order_addons (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  order_id   uuid not null references orders(id) on delete cascade,
  name       text not null,
  tier       text,
  price      numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index order_addons_order_idx  on order_addons (order_id);
create index order_addons_tenant_idx on order_addons (tenant_id);

alter table order_addons enable row level security;
grant select on order_addons to authenticated;

-- admin: whole tenant
create policy order_addons_admin on order_addons
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

-- the owning customer sees their own order's upsells (a customer can read their own order + customer
-- rows, so the subquery resolves under their RLS — no SECURITY DEFINER needed here).
create policy order_addons_customer on order_addons
  for select to authenticated
  using (
    current_app_role() = 'customer'
    and exists (
      select 1 from orders o join customers c on c.id = o.customer_id
      where o.id = order_addons.order_id and c.user_id = current_profile_id()
    )
  );
-- NOTE: no manager/staff policy on purpose (money-blind).
