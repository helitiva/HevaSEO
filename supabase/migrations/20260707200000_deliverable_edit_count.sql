-- Internal edit counter. When the customer hasn't viewed the delivered work yet, a staffer may correct it
-- IN PLACE (edit_deliverable) — the customer never sees a version bump, they just get the latest content of
-- the SAME version. But the staffer should still see how many times they've reworked it internally ("this is
-- the 2nd pass"). edit_count tracks those in-place edits; it is staff-facing only (never shown to the customer).
alter table deliverables add column if not exists edit_count int not null default 0;

-- Re-declare edit_deliverable to bump edit_count on each in-place correction (otherwise unchanged).
create or replace function edit_deliverable(p_deliverable uuid, p_summary text, p_files jsonb default '[]')
returns deliverables
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_pid    uuid := current_profile_id();
  v_row    deliverables;
begin
  if current_app_role() <> 'staff' then raise exception 'NOT_STAFF'; end if;
  select * into v_row from deliverables
    where id = p_deliverable and tenant_id = v_tenant and submitter_id = v_pid for update;
  if not found then raise exception 'NOT_YOUR_DELIVERABLE'; end if;
  if v_row.viewed_at is not null then raise exception 'ALREADY_VIEWED'; end if;
  update deliverables
     set summary    = nullif(btrim(coalesce(p_summary, '')), ''),
         files      = coalesce(p_files, '[]'::jsonb),
         edit_count = edit_count + 1
   where id = p_deliverable
   returning * into v_row;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'deliverable.edited', 'order', v_row.order_id);
  return v_row;
end $$;
revoke execute on function edit_deliverable(uuid, text, jsonb) from public;
grant  execute on function edit_deliverable(uuid, text, jsonb) to authenticated;
