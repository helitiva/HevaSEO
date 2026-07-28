-- E0b increment 1: identity spine — tenants + profiles + tenant-isolation RLS.
-- The tenant_id + RLS pattern here is the template every later table follows (ADR K5).

-- White-label root. HevaSEO runs as a single tenant; multi-brand = more rows (ADR §2.4).
create table tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  domain     text,
  theme      jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Concrete roles (ADR F5: keep rbac.ts roles; capabilities map on top, no fork-indirection).
create type app_role as enum ('admin', 'manager', 'staff', 'customer', 'affiliate');

create table profiles (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  user_id        uuid,                       -- FK to auth.users added in the auth phase; null = shadow/unclaimed
  email          citext not null,
  name           text,
  role           app_role not null,
  status         text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  two_fa_enabled boolean not null default false,
  created_at     timestamptz not null default now(),
  last_active_at timestamptz,
  unique (tenant_id, email)                   -- email unique within a tenant
);
-- Every RLS-predicate column is indexed (ADR §4).
create index profiles_tenant_idx on profiles (tenant_id);

-- JWT claim readers. PostgREST sets request.jwt.claims per request; pgTAP sets it manually.
-- tenant_id is injected by the Supabase access-token hook (ADR K10 / E0a+ PoC).
create or replace function current_tenant_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid $$;

-- RLS is the source of truth (ADR K4). Tenant scoping is the baseline; role rules layer on next.
alter table tenants  enable row level security;
alter table profiles enable row level security;

grant select on tenants, profiles to authenticated;

create policy tenants_own on tenants
  for select to authenticated
  using (id = current_tenant_id());

create policy profiles_same_tenant on profiles
  for select to authenticated
  using (tenant_id = current_tenant_id());
