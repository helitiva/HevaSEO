-- Broadcasts: admin → audiences one-to-many messages + an append-only event log for analytics.
-- Two-policy RLS per table: admin (manage/analytics) + recipient/own (see notes migration for the base pattern).

create type broadcast_kind as enum ('announcement', 'alert', 'update');
create type broadcast_status as enum ('draft', 'scheduled', 'live', 'recalled');

create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  body text,
  audiences text[] not null default '{}',          -- values among 'customer','staff','manager','affiliate'
  kind broadcast_kind not null default 'announcement',
  status broadcast_status not null default 'draft',
  scheduled_at timestamptz,
  created_by_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index broadcasts_tenant_idx on broadcasts (tenant_id);
create index broadcasts_audiences_idx on broadcasts using gin (audiences);
alter table broadcasts enable row level security;
grant select on broadcasts to authenticated;

-- Admin manages/analyzes all tenant broadcasts.
create policy broadcasts_admin on broadcasts
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

-- A recipient (whose role is in the broadcast's audiences) sees it.
create policy broadcasts_recipient on broadcasts
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = any(audiences));

create table broadcast_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  user_id uuid references profiles(id),
  kind text not null check (kind in ('sent', 'read', 'click')),
  created_at timestamptz not null default now()
);
create index broadcast_events_tenant_idx on broadcast_events (tenant_id);
create index broadcast_events_broadcast_idx on broadcast_events (broadcast_id);
alter table broadcast_events enable row level security;
grant select on broadcast_events to authenticated;

-- Admin sees all events for analytics.
create policy broadcast_events_admin on broadcast_events
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

-- A user sees only their own events.
create policy broadcast_events_own on broadcast_events
  for select to authenticated
  using (tenant_id = current_tenant_id() and user_id = current_profile_id());
