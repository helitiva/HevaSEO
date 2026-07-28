-- Lane C inc-C2: the auth hook now also injects the worker's `skills` (text[] from staff_details) into
-- the JWT claims, so the docs RLS skill-gate (current_skills() → claims->'skills') works end-to-end.
-- Without this, current_skills() was always {} and every skill-gated doc stayed invisible to all staff.
-- Recreates custom_access_token_hook (was 20260629070004) with a left join to staff_details.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_tenant uuid;
  v_role   app_role;
  v_pid    uuid;
  v_skills text[];
  v_claims jsonb;
begin
  select p.tenant_id, p.role, p.id, coalesce(sd.skills, '{}')
    into v_tenant, v_role, v_pid, v_skills
    from public.profiles p
    left join public.staff_details sd on sd.profile_id = p.id
   where p.user_id = (event->>'user_id')::uuid
   limit 1;

  v_claims := coalesce(event->'claims', '{}'::jsonb);
  if v_tenant is not null then
    v_claims := v_claims || jsonb_build_object(
      'tenant_id',  v_tenant::text,
      'app_role',   v_role::text,
      'profile_id', v_pid::text,
      'skills',     to_jsonb(coalesce(v_skills, '{}'::text[]))
    );
    event := jsonb_set(event, '{claims}', v_claims);
  end if;
  return event;
end $$;

-- GoTrue runs the hook as supabase_auth_admin; it must be able to read staff_details too (same fix as
-- profiles in 20260629070004 — otherwise the left join returns nothing and skills are silently dropped).
grant select on public.staff_details to supabase_auth_admin;
create policy staff_details_auth_admin_read on public.staff_details
  for select to supabase_auth_admin using (true);
