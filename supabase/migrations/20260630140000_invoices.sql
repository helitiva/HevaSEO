-- Phase 2 / inc-P1: invoices — a receipt per credit top-up payment. MONEY, so same money-blind
-- boundary as order_addons: only admin (tenant) and the owning customer may read; managers/staff get
-- NO policy → 0 rows. Written only by the service role (the top-up server action, after the payment
-- provider confirms a charge — mock now, Stripe later). `provider`/`provider_ref` record which gateway
-- settled the payment so a real Stripe webhook drops into the same row shape.
create table invoices (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  number       text not null,
  amount       numeric(12,2) not null check (amount > 0),
  status       text not null default 'issued' check (status in ('issued', 'processing', 'void')),
  provider     text not null default 'mock',
  provider_ref text,
  created_at   timestamptz not null default now(),
  unique (tenant_id, number)
);
create index invoices_customer_idx on invoices (customer_id, created_at desc);
create index invoices_tenant_idx   on invoices (tenant_id);

alter table invoices enable row level security;
grant select on invoices to authenticated;
-- the top-up action (service role) both writes invoices AND reads the latest one to compute the next
-- sequential number, so it needs SELECT + INSERT (service role is server-only / trusted).
grant select, insert on invoices to service_role;

-- admin: whole tenant
create policy invoices_admin on invoices
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

-- the owning customer sees their own invoices
create policy invoices_customer on invoices
  for select to authenticated
  using (
    current_app_role() = 'customer'
    and customer_id in (select id from customers where user_id = current_profile_id())
  );
-- NOTE: no manager/staff policy on purpose (money-blind).
