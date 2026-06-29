-- Customer projects + folders
-- Follows the established tenant-scoped RLS pattern (see customers migration).

create table folders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index folders_tenant_idx on folders (tenant_id);
create index folders_customer_idx on folders (customer_id);
alter table folders enable row level security;
grant select on folders to authenticated;
create policy folders_admin on folders
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy folders_customer_owns on folders
  for select to authenticated
  using (tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and exists (
      select 1 from customers c
      where c.id = folders.customer_id
        and c.user_id = current_profile_id()
    ));

create table projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);
create index projects_tenant_idx on projects (tenant_id);
create index projects_customer_idx on projects (customer_id);
create index projects_folder_idx on projects (folder_id);
alter table projects enable row level security;
grant select on projects to authenticated;
create policy projects_admin on projects
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy projects_customer_owns on projects
  for select to authenticated
  using (tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and exists (
      select 1 from customers c
      where c.id = projects.customer_id
        and c.user_id = current_profile_id()
    ));
