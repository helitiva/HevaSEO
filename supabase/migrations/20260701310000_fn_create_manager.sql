-- inc-E24: admin provisions a manager or admin via the shadow-profile → LINK model (mirrors E13/E23).
-- A manager/admin is just a profile with that role; pod membership is staff_details.manager_id (assigned
-- separately). Managers earn pod-override commission, so they get an initialized wallet; admins don't.
-- title/rank are display-only (untabled). The person claims by signing up with the same email.
create or replace function create_manager(p_name text, p_email text, p_role text)
returns profiles
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
  if p_role not in ('manager', 'admin') then raise exception 'BAD_ROLE'; end if;

  begin
    insert into profiles (tenant_id, user_id, email, name, role, status)
    values (v_tenant, null, p_email, trim(p_name), p_role::app_role, 'invited')
    returning * into v_prof;
  exception when unique_violation then raise exception 'EMAIL_TAKEN';
  end;

  -- managers accrue pod-override commission → give them a wallet; admins don't earn commission
  if p_role = 'manager' then
    insert into staff_wallet (staff_id, tenant_id, balance) values (v_prof.id, v_tenant, 0)
      on conflict (staff_id) do nothing;
  end if;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, p_role || '.created', 'profile', v_prof.id);
  return v_prof;
end $$;

revoke execute on function create_manager(text, text, text) from public;
grant  execute on function create_manager(text, text, text) to authenticated;
