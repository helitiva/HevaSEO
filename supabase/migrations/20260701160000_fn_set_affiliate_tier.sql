-- Lane E inc-E6: admin pins a partner's tier (override the volume-derived ladder) or reverts to auto.
-- A pinned tier wins over volume; reverting clears the pin so tier follows volume again. The console
-- reads tier_pinned to show the "override" badge + enable the Auto button. affiliates is SELECT-only
-- via RLS → the write goes through this admin-gated SECURITY DEFINER fn.
alter table affiliates add column if not exists tier_pinned boolean not null default false;

create or replace function set_affiliate_tier(p_affiliate uuid, p_tier text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
  v_tier   affiliate_tier;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;

  if p_tier is null then
    -- revert to auto: clear the pin, leave the stored tier as a harmless last-known value
    update affiliates set tier_pinned = false where id = p_affiliate and tenant_id = v_tenant;
  else
    v_tier := p_tier::affiliate_tier;  -- raises on an unknown tier
    update affiliates set tier = v_tier, tier_pinned = true where id = p_affiliate and tenant_id = v_tenant;
  end if;
  if not found then raise exception 'AFFILIATE_NOT_FOUND'; end if;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'affiliate.tier.' || coalesce(p_tier, 'auto'), 'affiliate', p_affiliate);
end $$;

revoke execute on function set_affiliate_tier(uuid, text) from public;
grant  execute on function set_affiliate_tier(uuid, text) to authenticated;
