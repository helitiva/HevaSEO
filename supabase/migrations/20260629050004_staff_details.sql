-- Per-staff operational profile: skills, capacity, role label, timezone, tenure, active flag.
-- NON-money — pay/salary lives in a separate gated domain and must NOT be added here.
-- Tenant+role RLS: admin sees the whole tenant; a staff member sees only their own row.
-- (Manager pod view is deferred — no manager policy yet.)

create table staff_details (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null unique references profiles(id) on delete cascade,
  skills     text[] not null default '{}',
  capacity   int not null default 0,
  role_label text,
  timezone   text,
  since      date,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index staff_details_tenant_idx  on staff_details (tenant_id);
create index staff_details_profile_idx on staff_details (profile_id);

alter table staff_details enable row level security;
grant select on staff_details to authenticated;

-- admin sees every staff_details row in their tenant
create policy staff_details_admin_all on staff_details
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

-- a staff member sees only their own operational profile
create policy staff_details_staff_own on staff_details
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'staff'
    and profile_id = current_profile_id()
  );
