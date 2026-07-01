-- Lane E inc-E14: affiliate self-service identity. Extends the E12 profile fn to also set the display
-- name (profiles.name) and adds referral-code editing (affiliates.code, unique per tenant). Email is
-- deliberately NOT editable here — it's the auth identity (GoTrue) and changing it needs a verified
-- re-auth flow, so the settings UI keeps it read-only. Claims-derived, own row, admin not involved.

-- Recreate update_affiliate_profile with p_name (was platform/niche/audience only in E12).
drop function if exists update_affiliate_profile(text, text, text);
create or replace function update_affiliate_profile(p_name text, p_platform text, p_niche text, p_audience text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_pid    uuid := current_profile_id();
  v_role   text := current_app_role();
  v_aff    uuid;
begin
  if v_role <> 'affiliate' then raise exception 'NOT_AFFILIATE'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'BAD_NAME'; end if;

  update profiles set name = trim(p_name) where id = v_pid and tenant_id = v_tenant;
  update affiliates set platform = p_platform, niche = p_niche, audience = p_audience
   where user_id = v_pid and tenant_id = v_tenant
   returning id into v_aff;
  if v_aff is null then raise exception 'NOT_AFFILIATE'; end if;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'affiliate.profile.update', 'affiliate', v_aff);
end $$;

revoke execute on function update_affiliate_profile(text, text, text, text) from public;
grant  execute on function update_affiliate_profile(text, text, text, text) to authenticated;

-- The affiliate changes their own referral code (unique per tenant → CODE_TAKEN).
create or replace function set_affiliate_code(p_code text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_pid    uuid := current_profile_id();
  v_role   text := current_app_role();
  v_aff    uuid;
begin
  if v_role <> 'affiliate' then raise exception 'NOT_AFFILIATE'; end if;
  if p_code is null or upper(p_code) !~ '^[A-Z0-9]{3,20}$' then raise exception 'BAD_CODE'; end if;
  begin
    update affiliates set code = upper(p_code) where user_id = v_pid and tenant_id = v_tenant
     returning id into v_aff;
  exception when unique_violation then raise exception 'CODE_TAKEN';
  end;
  if v_aff is null then raise exception 'NOT_AFFILIATE'; end if;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'affiliate.code.update', 'affiliate', v_aff);
end $$;

revoke execute on function set_affiliate_code(text) from public;
grant  execute on function set_affiliate_code(text) to authenticated;
