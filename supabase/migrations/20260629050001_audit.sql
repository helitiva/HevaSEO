-- Audit log: append-only event log of who-did-what across the tenant.
-- Admin-only RLS — non-admins see 0 rows. (Manager pod-scoped, money-stripped
-- audit is deferred — no non-admin policy here.)

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_tenant_idx on audit_log (tenant_id);
create index audit_log_tenant_created_idx on audit_log (tenant_id, created_at);
create index audit_log_entity_type_idx on audit_log (entity_type);
alter table audit_log enable row level security;
grant select on audit_log to authenticated;
create policy audit_log_admin_only on audit_log
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
