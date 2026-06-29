-- E0a+ PoC: Supabase custom-access-token Auth hook (ADR K10 / 0a+ gate).
-- GoTrue calls this on every token mint; it injects the worker's tenant_id + app_role + profile_id
-- into the JWT claims, which PostgREST exposes as request.jwt.claims → our RLS reads them.
-- (acting_as_id / read_only for impersonation layer on top in Phase 3.) No profile match → no custom
-- claims added → RLS returns 0 rows (anon-safe).

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
  v_claims jsonb;
begin
  select p.tenant_id, p.role, p.id
    into v_tenant, v_role, v_pid
    from public.profiles p
   where p.user_id = (event->>'user_id')::uuid
   limit 1;

  v_claims := coalesce(event->'claims', '{}'::jsonb);
  if v_tenant is not null then
    v_claims := v_claims || jsonb_build_object(
      'tenant_id',  v_tenant::text,
      'app_role',   v_role::text,
      'profile_id', v_pid::text
    );
    event := jsonb_set(event, '{claims}', v_claims);
  end if;
  return event;
end $$;

-- Only GoTrue may run the hook; never the API roles.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- GoTrue runs the hook as `supabase_auth_admin`. The hook (SECURITY INVOKER) reads profiles under
-- THAT role, so profiles' RLS applies — and there is no tenant policy for supabase_auth_admin, which
-- would return 0 rows and silently drop the claims. So grant it + an explicit read-all policy.
-- (Discovered by the E0a+ PoC: GoTrue logged "Hook ran successfully" but the JWT had no claims.)
grant select on public.profiles to supabase_auth_admin;
create policy profiles_auth_admin_read on public.profiles
  for select to supabase_auth_admin using (true);
