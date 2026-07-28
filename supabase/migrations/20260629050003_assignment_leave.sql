-- Assignment rules + staff leave requests.
-- assignment_rules: admin-managed routing (auto-assign or pin to a staff member).
--   Admin-only RLS — non-admins (manager/staff/customer/affiliate) see 0 rows.
-- leave_requests: staff time-off requests. Admin sees all tenant requests;
--   staff see only their own. (see catalog/notes migrations for the base pattern.)

create table assignment_rules (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  service         text not null,
  pkg             text,
  mode            text not null check (mode in ('auto', 'pin')),
  target_staff_id uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create index assignment_rules_tenant_idx on assignment_rules (tenant_id);

alter table assignment_rules enable row level security;
grant select on assignment_rules to authenticated;

-- admin-only: rules are admin-managed; everyone else sees 0 rows.
create policy assignment_rules_admin on assignment_rules
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create table leave_requests (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references profiles(id) on delete cascade,
  from_date  date not null,
  to_date    date not null,
  reason     text,
  status     text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);
create index leave_requests_tenant_idx on leave_requests (tenant_id);
create index leave_requests_staff_idx on leave_requests (staff_id);

alter table leave_requests enable row level security;
grant select on leave_requests to authenticated;

-- admin sees all tenant leave requests.
create policy leave_requests_admin on leave_requests
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

-- staff see only their own leave requests.
create policy leave_requests_staff_own on leave_requests
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'staff'
    and staff_id = current_profile_id()
  );
