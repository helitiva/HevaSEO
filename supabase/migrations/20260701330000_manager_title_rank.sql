-- inc-E26: persist manager title/rank (was localStorage-only). Staff title already lives in
-- staff_details.role_label (inc-E23); managers get their own staff_details "org card" row carrying
-- role_label (title) + a new `rank` column (skills/capacity empty — they're not in the staff roster,
-- which filters role='staff'). Recreate create_manager to capture title/rank at creation.
alter table staff_details add column if not exists rank text;

drop function if exists create_manager(text, text, text);
create or replace function create_manager(
  p_name text, p_email text, p_role text, p_title text default null, p_rank text default null
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
  if p_role not in ('manager', 'admin') then raise exception 'BAD_ROLE'; end if;

  begin
    insert into profiles (tenant_id, user_id, email, name, role, status)
    values (v_tenant, null, p_email, trim(p_name), p_role::app_role, 'invited')
    returning * into v_prof;
  exception when unique_violation then raise exception 'EMAIL_TAKEN';
  end;

  -- managers accrue pod-override commission → wallet; + an org card (title/rank). admins: neither.
  if p_role = 'manager' then
    insert into staff_wallet (staff_id, tenant_id, balance) values (v_prof.id, v_tenant, 0)
      on conflict (staff_id) do nothing;
    insert into staff_details (tenant_id, profile_id, skills, capacity, role_label, rank, since, active)
      values (v_tenant, v_prof.id, '{}', 0, nullif(btrim(coalesce(p_title, '')), ''),
              nullif(btrim(coalesce(p_rank, '')), ''), current_date, true)
      on conflict (profile_id) do nothing;
  end if;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, p_role || '.created', 'profile', v_prof.id);
  return v_prof;
end $$;

revoke execute on function create_manager(text, text, text, text, text) from public;
grant  execute on function create_manager(text, text, text, text, text) to authenticated;
