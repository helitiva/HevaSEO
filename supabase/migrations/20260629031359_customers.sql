-- E0b increment 2: customers (no-money slice).
-- spend/balance are NOT columns here: authoritative balance lives in customer_balances
-- (ADR K11/K3), built in the gated money increment. tier is denormalized for fast lookup.

create type customer_status as enum ('shadow', 'claimed');
create type customer_tier   as enum ('new', 'silver', 'gold', 'vip');

create table customers (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  user_id        uuid references profiles(id),   -- null while shadow (unclaimed order)
  name           text not null,
  company        text,
  email          citext,
  status         customer_status not null default 'shadow',
  tier           customer_tier not null default 'new',
  phone          text,
  timezone       text,
  member_since   date,
  tags           text[] not null default '{}',
  referrer_id    uuid,                            -- → affiliates (FK added with affiliate tables)
  created_at     timestamptz not null default now(),
  last_active_at date
);
create index customers_tenant_idx on customers (tenant_id);
create index customers_user_idx   on customers (user_id);

-- Requester identity from JWT custom claims (Auth hook injects app_role + profile_id — ADR K10).
create or replace function current_app_role() returns text
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'app_role', '') $$;

create or replace function current_profile_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'profile_id', '')::uuid $$;

alter table customers enable row level security;
grant select on customers to authenticated;

-- Ops (admin/manager) see tenant customers; a customer sees only their own record.
-- Manager pod-scoping + money-stripped view layer on at the gated money increment.
create policy customers_visibility on customers
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and (
      current_app_role() in ('admin', 'manager')
      or user_id = current_profile_id()
    )
  );
