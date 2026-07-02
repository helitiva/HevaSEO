-- Projects & Folders CRUD: the tables existed with SELECT-only RLS (read), so customers couldn't create
-- or manage them. Add the fields the UI needs and the write policies so customers own their own projects
-- and folders (admin keeps full access via the existing *_admin policies).

alter table projects add column if not exists domain text;
alter table projects add column if not exists status text not null default 'planned';
alter table projects add column if not exists note   text;
alter table folders  add column if not exists color     text;
alter table folders  add column if not exists parent_id uuid references folders(id) on delete set null;

-- write policies — a customer may insert/update/delete rows they own (customer_id → their profile).
create policy projects_customer_write on projects for all to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'customer'
         and exists (select 1 from customers c where c.id = projects.customer_id and c.user_id = current_profile_id()))
  with check (tenant_id = current_tenant_id() and current_app_role() = 'customer'
         and exists (select 1 from customers c where c.id = projects.customer_id and c.user_id = current_profile_id()));

create policy folders_customer_write on folders for all to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'customer'
         and exists (select 1 from customers c where c.id = folders.customer_id and c.user_id = current_profile_id()))
  with check (tenant_id = current_tenant_id() and current_app_role() = 'customer'
         and exists (select 1 from customers c where c.id = folders.customer_id and c.user_id = current_profile_id()));

-- admin may also manage (the existing *_admin policies are SELECT-only) — add a write policy for admins.
create policy projects_admin_write on projects for all to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin')
  with check (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy folders_admin_write on folders for all to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin')
  with check (tenant_id = current_tenant_id() and current_app_role() = 'admin');

-- table-level grants: the write policies gate ROWS, but the role still needs the operation privilege.
grant select, insert, update, delete on projects to authenticated;
grant select, insert, update, delete on folders  to authenticated;
