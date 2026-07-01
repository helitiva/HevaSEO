-- SECURITY (HIGH, CSO re-review) — close an unauthenticated privilege-escalation path.
--
-- Finding: handle_new_user's LINK claimed ANY unclaimed shadow by bare email match, with no role
-- restriction. With email confirmations OFF (supabase/config.toml enable_confirmations=false), an anon
-- attacker who signs up (or triggers /api/public/checkout, which uses email_confirm:true + an
-- attacker-chosen password) with a pending privileged invite's email would CLAIM that staff/manager/
-- affiliate/admin profile and log in with elevated role. Proven via SQL PoC (a staff shadow flipped to
-- claimed on an auth.users insert with the matching email).
--
-- Fix: a bare email match may only ever hand out a CUSTOMER identity. Privileged invites
-- (staff/manager/admin/affiliate) must be claimed through an explicit invite flow (admin sets the
-- credential at provision time, or a signed invite token) — NOT open self-signup. And never CREATE a
-- fresh customer row over an email that already belongs to a (privileged) shadow: leave the auth user
-- profile-less so it gets no JWT claims (RLS → 0 rows) instead of escalating or hitting the unique
-- constraint. The companion checkout guard (route.ts) refuses non-customer emails before createUser.
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
  -- (1) LINK: claim a CUSTOMER shadow in place. Privileged shadows are intentionally NOT matched here.
  update public.profiles
     set user_id = new.id,
         name    = coalesce(name, v_name),
         status  = 'active'
   where tenant_id = v_agency
     and email     = new.email
     and user_id is null
     and role      = 'customer';

  if not found then
    -- A non-customer shadow (or any existing profile) owns this email → do NOT create a customer row
    -- over it. Leave the auth user without a profile: the access-token hook adds no claims, so RLS
    -- returns 0 rows and the account is inert until claimed through the proper privileged-invite flow.
    if exists (select 1 from public.profiles where tenant_id = v_agency and email = new.email) then
      return new;
    end if;

    -- (2) CREATE: genuinely new email → fresh forced-customer profile (metadata role stays untrusted).
    insert into public.profiles (tenant_id, user_id, email, name, role)
    values (v_agency, new.id, new.email, v_name, 'customer');
  end if;

  return new;
end $$;
