-- supabase/seed.sql
-- Seed data applied after migrations on `supabase db reset`.
-- The HevaSEO agency tenant (a9e0c0de-…-0001) is created by the handle_new_user migration.
--
-- Lane A inc-2b — demo auth accounts. Five personas, one per role, password `demo1234`, so every
-- portal is reachable against real Supabase Auth out of the box (replaces the old localStorage mock).
-- Order matters: we insert a SHADOW profile (correct role, user_id NULL) BEFORE the auth.users row,
-- so the on_auth_user_created trigger takes the LINK path and preserves the role. (If the auth user
-- came first, the trigger's CREATE path would force everyone to `customer`.)
-- bcrypt via extensions.crypt; each user also needs an auth.identities row for email/password login.

do $$
declare
  v_agency constant uuid := 'a9e0c0de-0000-4000-8000-000000000001';
  r record;
begin
  for r in
    select * from (values
      ('d000aaaa-0000-4000-8000-000000000001'::uuid, 'admin@hevaseo.com', 'Admin',        'admin'::app_role),
      ('d000aaaa-0000-4000-8000-000000000002'::uuid, 'sofia@hevaseo.com', 'Sofia Marin',  'manager'::app_role),
      ('d000aaaa-0000-4000-8000-000000000003'::uuid, 'mai@hevaseo.com',   'Mai T.',       'staff'::app_role),
      ('d000aaaa-0000-4000-8000-000000000004'::uuid, 'jane@acme.com',     'Jane Doe',     'customer'::app_role),
      ('d000aaaa-0000-4000-8000-000000000005'::uuid, 'jane@janeseo.com',  'Jane Rivera',  'affiliate'::app_role)
    ) as t(uid, email, name, role)
  loop
    -- shadow profile (claimed by the trigger when the auth user is inserted below)
    insert into public.profiles (tenant_id, user_id, email, name, role, status)
    values (v_agency, null, r.email, r.name, r.role, 'invited')
    on conflict (tenant_id, email) do nothing;

    -- auth user with a confirmed email + bcrypt password → trigger LINKs the shadow above.
    -- The *_token / *_change columns must be '' not NULL: GoTrue scans them into Go strings and a
    -- direct SQL insert that leaves them NULL makes login 500 ("converting NULL to string").
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', r.uid, 'authenticated', 'authenticated', r.email,
      extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', r.name), now(), now(),
      '', '', '', '', '', '', '', ''
    ) on conflict (id) do nothing;

    -- email-provider identity (required for password sign-in)
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.uid, r.uid::text,
      jsonb_build_object('sub', r.uid::text, 'email', r.email, 'email_verified', true),
      'email', now(), now(), now()
    ) on conflict (provider_id, provider) do nothing;
  end loop;
end $$;
