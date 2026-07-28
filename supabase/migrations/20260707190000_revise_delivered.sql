-- Post-delivery staff revision. Once the customer has opened the delivered work, the staffer can no longer
-- edit it in place (edit_deliverable raises ALREADY_VIEWED) — they submit a REVISION instead. A revision is
-- a brand-new version that is RE-DELIVERED to the customer immediately (the work was already manager-approved
-- once at delivery; a self-correction re-delivers rather than re-queuing review). The order stays 'delivered'
-- and delivered_at resets so the customer's review window restarts.
--
-- Atomic + claims-derived: only the order's assignee, only while the order is 'delivered'. deliverables is
-- SELECT-only via RLS so the insert goes through this SECURITY DEFINER fn.
create or replace function revise_delivered(p_order uuid, p_summary text, p_files jsonb default '[]')
returns deliverables
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant  uuid := current_tenant_id();
  v_pid     uuid := current_profile_id();
  v_version int;
  v_row     deliverables;
begin
  if current_app_role() <> 'staff' then raise exception 'NOT_STAFF'; end if;
  if not exists (
    select 1 from orders
     where id = p_order and tenant_id = v_tenant and assignee_id = v_pid and state = 'delivered'
  ) then
    raise exception 'NOT_REVISABLE';  -- not the assignee, or the order isn't in the delivered state
  end if;

  select coalesce(max(version), 0) + 1 into v_version from deliverables where order_id = p_order;
  insert into deliverables (tenant_id, order_id, submitter_id, version, status, summary, files, reviewed_at)
       values (v_tenant, p_order, v_pid, v_version, 'approved',
               nullif(btrim(coalesce(p_summary, '')), ''), coalesce(p_files, '[]'::jsonb), now())
    returning * into v_row;
  update orders set delivered_at = now() where id = p_order;  -- restart the customer's review window
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'deliverable.revised', 'order', p_order);
  return v_row;
end $$;
revoke execute on function revise_delivered(uuid, text, jsonb) from public;
grant  execute on function revise_delivered(uuid, text, jsonb) to authenticated;
