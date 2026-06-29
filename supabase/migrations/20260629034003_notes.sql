-- Private notes: per-user private notebook + attachments.
-- Owner-only RLS — notes are private even from admin (see customers migration for the base pattern).

create table notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  surface text not null check (surface in ('admin', 'staff', 'manager', 'customer')),
  title text,
  body jsonb not null default '{}',
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_tenant_idx on notes (tenant_id);
create index notes_owner_idx on notes (owner_id);
alter table notes enable row level security;
grant select on notes to authenticated;
create policy notes_owner_only on notes
  for select to authenticated
  using (tenant_id = current_tenant_id() and owner_id = current_profile_id());

create table note_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  note_id uuid not null references notes(id) on delete cascade,
  kind text not null,
  url text not null,
  name text,
  created_at timestamptz not null default now()
);
create index note_attachments_tenant_idx on note_attachments (tenant_id);
create index note_attachments_note_idx on note_attachments (note_id);
alter table note_attachments enable row level security;
grant select on note_attachments to authenticated;
create policy note_attachments_owner_only on note_attachments
  for select to authenticated
  using (tenant_id = current_tenant_id()
    and exists (
      select 1 from notes n
      where n.id = note_attachments.note_id
        and n.owner_id = current_profile_id()
    ));
