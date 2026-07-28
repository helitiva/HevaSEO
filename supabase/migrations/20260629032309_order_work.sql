-- E0b increment 4: tasks + deliverables (the delivery loop). Non-money — fully tenant+role RLS.

create type task_state         as enum ('pending', 'in_progress', 'submitted', 'done');
create type deliverable_status as enum ('submitted', 'approved', 'changes_requested');

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  order_id    uuid not null references orders(id) on delete cascade,
  assignee_id uuid references profiles(id),       -- staff; null until assigned
  title       text not null,
  brief       text,
  state       task_state not null default 'pending',
  priority    order_priority not null default 'med',
  deadline    timestamptz,
  created_at  timestamptz not null default now()
);
create index tasks_tenant_idx   on tasks (tenant_id);
create index tasks_order_idx     on tasks (order_id);
create index tasks_assignee_idx  on tasks (assignee_id);

create table deliverables (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  order_id     uuid not null references orders(id) on delete cascade,
  task_id      uuid references tasks(id) on delete set null,
  submitter_id uuid not null references profiles(id),   -- staff who submitted
  version      int not null default 1,
  status       deliverable_status not null default 'submitted',
  summary      text,
  files        jsonb not null default '[]',
  submitted_at timestamptz not null default now()
);
create index deliverables_tenant_idx on deliverables (tenant_id);
create index deliverables_order_idx  on deliverables (order_id);
create unique index deliverables_order_version_idx on deliverables (order_id, version);

alter table tasks        enable row level security;
alter table deliverables enable row level security;
grant select on tasks, deliverables to authenticated;

-- tasks: admin sees tenant; staff sees the tasks assigned to them.
create policy tasks_admin_all on tasks
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create policy tasks_staff_assigned on tasks
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'staff'
    and assignee_id = current_profile_id()
  );

-- deliverables: admin sees tenant; staff sees their own submissions;
-- customer sees only APPROVED deliverables for their own orders.
create policy deliverables_admin_all on deliverables
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create policy deliverables_staff_own on deliverables
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'staff'
    and submitter_id = current_profile_id()
  );

create policy deliverables_customer_approved on deliverables
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and status = 'approved'
    and exists (
      select 1 from orders o
      join customers c on c.id = o.customer_id
      where o.id = deliverables.order_id
        and c.user_id = current_profile_id()
    )
  );
