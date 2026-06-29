-- Service catalog: admin-managed product line; customers browse it to order.
-- Access rule: only admin and customer can read the catalog. Managers and staff
-- have NO catalog access (manager role is money/pricing-blind) — no policies are
-- written for them, so they see 0 rows. price here is the customer-facing SELL
-- price, visible to admin + customer; it is NOT money-blind data.
-- Follows the established tenant-scoped RLS pattern (see customers/projects migration).

create type pricing_type as enum ('flat', 'range', 'usage', 'custom');

create table catalog_services (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  key          text not null,
  label        text not null,
  pricing_type pricing_type not null default 'flat',
  description  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index catalog_services_tenant_idx on catalog_services (tenant_id);
create unique index catalog_services_tenant_key_idx on catalog_services (tenant_id, key);

create table catalog_packages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  service_id  uuid not null references catalog_services(id) on delete cascade,
  name        text not null,
  price       numeric(12,2) not null default 0,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index catalog_packages_tenant_idx on catalog_packages (tenant_id);
create index catalog_packages_service_idx on catalog_packages (service_id);

alter table catalog_services enable row level security;
alter table catalog_packages enable row level security;
grant select on catalog_services, catalog_packages to authenticated;

-- catalog_services: admin sees all tenant services; customer sees active only.
create policy catalog_services_admin on catalog_services
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create policy catalog_services_customer on catalog_services
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and active = true
  );

-- catalog_packages: admin sees all tenant packages; customer sees active only.
create policy catalog_packages_admin on catalog_packages
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create policy catalog_packages_customer on catalog_packages
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and active = true
  );
