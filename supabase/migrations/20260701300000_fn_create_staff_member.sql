-- Lane C/A inc-E23: admin provisions a staff member via the shadow-profile → LINK model (mirrors the
-- affiliate create_affiliate_partner, inc-E13): a shadow profile (role staff, user_id null, invited) +
-- staff_details (skills/capacity) + an initialized wallet. The person claims it by signing up with the
-- same email (handle_new_user LINKs, preserving the role). No client-trusted role, no auth-user creation.
create or replace function create_staff_member(
  p_name text, p_email text, p_role_label text, p_capacity int, p_skills text[]
) returns profiles
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
  v_prof   profiles;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'BAD_NAME'; end if;
  if p_email is null or p_email !~ '^.+@.+\..+$' then raise exception 'BAD_EMAIL'; end if;

  begin
    insert into profiles (tenant_id, user_id, email, name, role, status)
    values (v_tenant, null, p_email, trim(p_name), 'staff', 'invited')
    returning * into v_prof;
  exception when unique_violation then raise exception 'EMAIL_TAKEN';
  end;

  insert into staff_details (tenant_id, profile_id, skills, capacity, role_label, since, active)
       values (v_tenant, v_prof.id, coalesce(p_skills, '{}'), greatest(coalesce(p_capacity, 0), 0),
               nullif(btrim(coalesce(p_role_label, '')), ''), current_date, true);
  insert into staff_wallet (staff_id, tenant_id, balance) values (v_prof.id, v_tenant, 0)
    on conflict (staff_id) do nothing;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'staff.created', 'profile', v_prof.id);
  return v_prof;
end $$;

revoke execute on function create_staff_member(text, text, text, int, text[]) from public;
grant  execute on function create_staff_member(text, text, text, int, text[]) to authenticated;
