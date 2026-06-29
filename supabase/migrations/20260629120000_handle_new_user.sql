-- Lane A inc-2 (auth session): provision a profiles row when GoTrue creates an auth user.
-- The custom_access_token_hook (E0a+) resolves JWT claims by `profiles.user_id = auth.users.id`,
-- so every account MUST have a linked profile or its claims come back empty (RLS → 0 rows).
--
-- Two paths (mirrors the shadow→claimed model in CONTRACTS §A / B):
--   (1) LINK   — an existing shadow profile (admin-provisioned staff/manager, or a quick-order
--                shadow customer) with the same email and user_id IS NULL gets claimed. The role and
--                entity wiring set by the admin/quick-order flow is preserved.
--   (2) CREATE — a self-signup with no shadow profile gets a fresh profile.
--
-- SECURITY (gác③): `raw_user_meta_data` is CLIENT-CONTROLLED (signUp options.data). We therefore
-- NEVER trust it for role or tenant — a self-signup is always a `customer` in the agency tenant.
-- Privileged roles (staff/manager/admin/affiliate) and any non-agency tenant are provisioned
-- server-side as shadow profiles (admin flow / service role) and reach their role via the LINK path,
-- where the metadata role is ignored. Only the display `name` is taken from metadata (harmless).
-- SECURITY DEFINER + pinned search_path so the trigger can write profiles and can't be hijacked.

-- The single HevaSEO agency tenant (ADR §2.4 — one agency serving many customers). Seeded here so
-- the FK below is always valid and a fresh self-signup always lands somewhere. Distinct from the
-- pgTAP fixtures (1111/2222/3333). Demo accounts are seeded into this tenant in seed.sql.
insert into public.tenants (id, name)
values ('a9e0c0de-0000-4000-8000-000000000001', 'HevaSEO')
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency constant uuid := 'a9e0c0de-0000-4000-8000-000000000001';
  v_name   text := nullif(new.raw_user_meta_data ->> 'name', '');
begin
  -- (1) LINK: claim a shadow profile in place (preserve its admin-set role/entity wiring).
  update public.profiles
     set user_id = new.id,
         name    = coalesce(name, v_name),
         status  = 'active'
   where tenant_id = v_agency
     and email     = new.email
     and user_id is null;

  -- (2) CREATE: no shadow to claim → fresh profile. Forced customer/agency: signup metadata is
  -- untrusted, so it can never escalate role or cross tenants.
  if not found then
    insert into public.profiles (tenant_id, user_id, email, name, role)
    values (v_agency, new.id, new.email, v_name, 'customer');
  end if;

  return new;
end $$;

-- GoTrue inserts into auth.users; this fires after each insert to materialize the profile.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
