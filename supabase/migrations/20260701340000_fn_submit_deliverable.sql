-- inc-E27: staff submits a deliverable on their assigned order (was mock — the state move via
-- advance_order was real, but no deliverable row was created). Claims-derived: only the order's assignee
-- may submit; a new version is appended (status 'submitted'). deliverables is SELECT-only via RLS → the
-- write goes through this SECURITY DEFINER fn. Files are a jsonb array ([{kind,fileName,url}]).
create or replace function submit_deliverable(p_order uuid, p_summary text, p_files jsonb default '[]')
returns deliverables
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant  uuid := current_tenant_id();
  v_pid     uuid := current_profile_id();
  v_role    text := current_app_role();
  v_version int;
  v_row     deliverables;
begin
  if v_role <> 'staff' then raise exception 'NOT_STAFF'; end if;
  if not exists (select 1 from orders where id = p_order and tenant_id = v_tenant and assignee_id = v_pid) then
    raise exception 'NOT_YOUR_ORDER';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from deliverables where order_id = p_order;
  insert into deliverables (tenant_id, order_id, submitter_id, version, status, summary, files)
       values (v_tenant, p_order, v_pid, v_version, 'submitted', nullif(btrim(coalesce(p_summary, '')), ''),
               coalesce(p_files, '[]'::jsonb))
    returning * into v_row;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'deliverable.submitted', 'order', p_order);
  return v_row;
end $$;

revoke execute on function submit_deliverable(uuid, text, jsonb) from public;
grant  execute on function submit_deliverable(uuid, text, jsonb) to authenticated;
