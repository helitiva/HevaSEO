-- inc-E28: admin reviews a submitted deliverable — approve or request changes (was mock). Sets status +
-- reviewed_at + review_note. Admin-gated; idempotent (only a 'submitted' version can be reviewed).
-- deliverables is SELECT-only via RLS → the write goes through this SECURITY DEFINER fn. The order state
-- move (→approved / →changes_requested) stays advance_order, called alongside from the review action.
create or replace function review_deliverable(p_deliverable uuid, p_action text, p_note text default null)
returns deliverables
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
  v_status deliverable_status;
  v_row    deliverables;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  v_status := case p_action when 'approve' then 'approved'
                            when 'request_changes' then 'changes_requested' end;
  if v_status is null then raise exception 'BAD_ACTION'; end if;

  select * into v_row from deliverables where id = p_deliverable and tenant_id = v_tenant for update;
  if not found then raise exception 'DELIVERABLE_NOT_FOUND'; end if;
  if v_row.status <> 'submitted' then raise exception 'ALREADY_REVIEWED'; end if;

  update deliverables set status = v_status, reviewed_at = now(), review_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_deliverable returning * into v_row;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'deliverable.' || p_action, 'order', v_row.order_id);
  return v_row;
end $$;

revoke execute on function review_deliverable(uuid, text, text) from public;
grant  execute on function review_deliverable(uuid, text, text) to authenticated;
