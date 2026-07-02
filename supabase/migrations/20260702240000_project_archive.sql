-- Projects can be archived (soft hide) instead of hard-deleted. "Move to Archive" on a folder archives
-- its projects and removes the now-empty folder; archived projects live under a virtual "Archive" rail
-- entry and can be restored. Writes go through the existing projects_customer_write RLS (own rows).
alter table projects add column if not exists archived boolean not null default false;
create index if not exists projects_archived_idx on projects (customer_id, archived);
