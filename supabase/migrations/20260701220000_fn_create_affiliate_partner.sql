-- Lane E inc-E13: admin provisions a new affiliate partner. Follows the shadow-profile → LINK model
-- (handle_new_user): the admin creates a SHADOW profile (role affiliate, user_id null) + an affiliates
-- row; the partner claims it by signing up with the same email (GoTrue trigger LINKs, preserving the
-- role). No client-trusted role, no auth-user creation here. Admin-gated SECURITY DEFINER; atomic (any
-- unique clash rolls the whole thing back).
create or replace function create_affiliate_partner(
  p_name text, p_email text, p_code text, p_tier text,
  p_platform text default null, p_niche text default null, p_audience text default null
) returns affiliates
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
  v_pid    uuid;
  v_aff    affiliates;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'BAD_NAME'; end if;
  if p_email is null or p_email !~ '^.+@.+\..+$' then raise exception 'BAD_EMAIL'; end if;
  if p_code is null or upper(p_code) !~ '^[A-Z0-9]{3,20}$' then raise exception 'BAD_CODE'; end if;

  -- shadow profile (claimed on signup via handle_new_user LINK). email unique per tenant.
  begin
    insert into profiles (tenant_id, user_id, email, name, role, status)
    values (v_tenant, null, p_email, trim(p_name), 'affiliate', 'invited')
    returning id into v_pid;
  exception when unique_violation then raise exception 'EMAIL_TAKEN';
  end;

  -- affiliate row. tier pinned when the admin picks an explicit starting tier (0-volume would be Bronze).
  begin
    insert into affiliates (tenant_id, user_id, code, tier, status, joined_at, platform, niche, audience, tier_pinned)
    values (v_tenant, v_pid, upper(p_code), coalesce(p_tier, 'bronze')::affiliate_tier, 'active', current_date,
            p_platform, p_niche, p_audience, p_tier is not null)
    returning * into v_aff;
  exception when unique_violation then raise exception 'CODE_TAKEN';
  end;

  -- init the commission wallet (balance == SUM(ledger) == 0) so partner money reads work.
  insert into affiliate_commission (affiliate_id, tenant_id, balance) values (v_aff.id, v_tenant, 0)
    on conflict (affiliate_id) do nothing;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'affiliate.created', 'affiliate', v_aff.id);
  return v_aff;
end $$;

revoke execute on function create_affiliate_partner(text, text, text, text, text, text, text) from public;
grant  execute on function create_affiliate_partner(text, text, text, text, text, text, text) to authenticated;
