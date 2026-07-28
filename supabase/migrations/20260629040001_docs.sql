-- Docs: a knowledge base distributed to audiences ('customer','staff','manager').
-- Staff docs are additionally skill-gated via required_skills && the viewer's JWT skills claim.
-- Follows the established tenant-scoped RLS pattern (see customers/projects migrations).

-- JWT claim reader for the viewer's skills array (PostgREST sets request.jwt.claims; pgTAP sets it manually).
-- Returns '{}' when the claim is absent so skill-gated SELECT predicates stay well-defined.
create or replace function current_skills() returns text[]
  language sql stable
  as $$ select coalesce(array(select jsonb_array_elements_text((nullif(current_setting('request.jwt.claims', true),''))::jsonb -> 'skills')), '{}'::text[]) $$;

create table docs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  body jsonb not null default '{}',
  audiences text[] not null default '{}',
  required_skills text[] not null default '{}',
  pinned boolean not null default false,
  author_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index docs_tenant_idx on docs (tenant_id);
create index docs_audiences_idx on docs using gin (audiences);

alter table docs enable row level security;
grant select on docs to authenticated;

-- admin sees all tenant docs
create policy docs_admin on docs
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

-- customer sees docs distributed to the customer audience
create policy docs_customer on docs
  for select to authenticated
  using (tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and 'customer' = any(audiences));

-- manager sees docs distributed to the manager audience
create policy docs_manager on docs
  for select to authenticated
  using (tenant_id = current_tenant_id()
    and current_app_role() = 'manager'
    and 'manager' = any(audiences));

-- staff sees staff-audience docs, additionally skill-gated: ungated docs are visible to all staff,
-- gated docs require at least one overlapping skill between required_skills and the viewer's skills.
create policy docs_staff on docs
  for select to authenticated
  using (tenant_id = current_tenant_id()
    and current_app_role() = 'staff'
    and 'staff' = any(audiences)
    and (cardinality(required_skills) = 0 or required_skills && current_skills()));
