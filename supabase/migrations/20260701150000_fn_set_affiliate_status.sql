-- Lane E inc-E5: admin approves / suspends / reactivates an affiliate. Admin-gated + claims-derived
-- tenant. The console's UI status is 'active'|'pending'|'suspended'; 'suspended' maps to the DB enum
-- 'churned'. affiliates is SELECT-only via RLS → the write goes through this SECURITY DEFINER fn.
create or replace function set_affiliate_status(p_affiliate uuid, p_status text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
  v_status affiliate_status;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  v_status := case p_status when 'suspended' then 'churned' else p_status end::affiliate_status;
  if v_status not in ('pending', 'active', 'churned') then raise exception 'INVALID_STATUS'; end if;

  update affiliates set status = v_status where id = p_affiliate and tenant_id = v_tenant;
  if not found then raise exception 'AFFILIATE_NOT_FOUND'; end if;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'affiliate.' || p_status, 'affiliate', p_affiliate);
end $$;

revoke execute on function set_affiliate_status(uuid, text) from public;
grant  execute on function set_affiliate_status(uuid, text) to authenticated;
