-- Personal in-app notifications: per-user notification feed.
-- Owner-only RLS — notifications are personal; even admin only sees their own (see notes migration for the base pattern).

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_tenant_idx on notifications (tenant_id);
create index notifications_user_idx on notifications (user_id);
alter table notifications enable row level security;
grant select on notifications to authenticated;
create policy notifications_owner_only on notifications
  for select to authenticated
  using (tenant_id = current_tenant_id() and user_id = current_profile_id());
