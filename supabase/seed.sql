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
      -- auth user id (uid)                          profile id (pid)                              email                name           role
      ('d000aaaa-0000-4000-8000-000000000001'::uuid, 'b000aaaa-0000-4000-8000-000000000001'::uuid, 'admin@hevaseo.com', 'Admin',        'admin'::app_role),
      ('d000aaaa-0000-4000-8000-000000000002'::uuid, 'b000aaaa-0000-4000-8000-000000000002'::uuid, 'sofia@hevaseo.com', 'Sofia Marin',  'manager'::app_role),
      ('d000aaaa-0000-4000-8000-000000000003'::uuid, 'b000aaaa-0000-4000-8000-000000000003'::uuid, 'mai@hevaseo.com',   'Mai T.',       'staff'::app_role),
      ('d000aaaa-0000-4000-8000-000000000004'::uuid, 'b000aaaa-0000-4000-8000-000000000004'::uuid, 'jane@acme.com',     'Jane Doe',     'customer'::app_role),
      ('d000aaaa-0000-4000-8000-000000000005'::uuid, 'b000aaaa-0000-4000-8000-000000000005'::uuid, 'jane@janeseo.com',  'Jane Rivera',  'affiliate'::app_role)
    ) as t(uid, pid, email, name, role)
  loop
    -- shadow profile with a DETERMINISTIC id (so customers/orders below can FK to it). Claimed by the
    -- trigger (user_id set) when the auth user is inserted below.
    insert into public.profiles (id, tenant_id, user_id, email, name, role, status)
    values (r.pid, v_agency, null, r.email, r.name, r.role, 'invited')
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

-- Lane A inc-3a — demo domain rows (customers + orders) so the order pages read REAL data.
-- All in the agency tenant. "Acme Co" is claimed by the demo customer (jane@acme.com profile) so the
-- customer-own RLS path is exercisable; others stay shadow. Mirrors a subset of the old adminMock so
-- the UI looks continuous. Orders assigned to a real staff profile (Mai) carry assignee_id; the rest
-- are unassigned (the staff names in the old mock aren't all seeded as profiles yet).
insert into public.customers (id, tenant_id, user_id, name, company, email, status, tier, member_since) values
  ('c0000000-0000-4000-8000-000000000001', 'a9e0c0de-0000-4000-8000-000000000001', 'b000aaaa-0000-4000-8000-000000000004', 'Jane Doe',  'Acme Co',      'jane@acme.com',   'claimed', 'gold',   '2025-01-01'),
  ('c0000000-0000-4000-8000-000000000002', 'a9e0c0de-0000-4000-8000-000000000001', null,                                   'Bright Ltd','Bright Ltd',   'ops@bright.co',   'shadow',  'silver', '2025-03-12'),
  ('c0000000-0000-4000-8000-000000000003', 'a9e0c0de-0000-4000-8000-000000000001', null,                                   'Nova',      'Nova',         'hi@nova.io',      'shadow',  'gold',   '2025-02-08'),
  ('c0000000-0000-4000-8000-000000000004', 'a9e0c0de-0000-4000-8000-000000000001', null,                                   'Vértice',   'Vértice',      'team@vertice.es', 'shadow',  'silver', '2025-04-20'),
  ('c0000000-0000-4000-8000-000000000005', 'a9e0c0de-0000-4000-8000-000000000001', null,                                   'Peak Digital','Peak Digital','hello@peak.dig',  'shadow',  'new',    '2025-05-30'),
  ('c0000000-0000-4000-8000-000000000006', 'a9e0c0de-0000-4000-8000-000000000001', null,                                   'Lumen',     'Lumen',        'contact@lumen.co','shadow',  'new',    '2025-06-15')
on conflict (id) do nothing;

-- code, customer, service, pkg, state, priority, source, value, assignee(Mai|null), deadline, created
insert into public.orders (tenant_id, code, customer_id, service, pkg, state, priority, source, value, assignee_id, deadline, created_at) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'AUD-1001', 'c0000000-0000-4000-8000-000000000001', 'Audit',        'Standard',    'new',               'high', 'quick',     39,  null,                                   '2026-06-26', '2026-06-24'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'CNT-1004', 'c0000000-0000-4000-8000-000000000001', 'Content',      '10 articles', 'delivered',         'med',  'quick',     120, null,                                   '2026-06-27', '2026-06-20'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'KW-1013',  'c0000000-0000-4000-8000-000000000001', 'Keyword',      'Standard',    'completed',         'med',  'dashboard', 39,  'b000aaaa-0000-4000-8000-000000000003', '2026-06-19', '2026-06-13'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'KW-1002',  'c0000000-0000-4000-8000-000000000002', 'Keyword',      'Standard',    'in_progress',       'med',  'dashboard', 39,  'b000aaaa-0000-4000-8000-000000000003', '2026-06-25', '2026-06-23'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'BL-1014',  'c0000000-0000-4000-8000-000000000002', 'Backlink',     'Starter',     'changes_requested', 'high', 'quick',     36,  null,                                   '2026-06-24', '2026-06-12'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'BL-1003',  'c0000000-0000-4000-8000-000000000003', 'Backlink',     'Growth',      'internal_review',   'high', 'dashboard', 64,  null,                                   '2026-06-24', '2026-06-21'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'BL-1006',  'c0000000-0000-4000-8000-000000000003', 'Backlink',     'Power',       'assigned',          'high', 'dashboard', 104, null,                                   '2026-06-28', '2026-06-22'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'OPT-1005', 'c0000000-0000-4000-8000-000000000004', 'Optimization', 'Standard',    'completed',         'low',  'dashboard', 79,  'b000aaaa-0000-4000-8000-000000000003', '2026-06-22', '2026-06-18'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'OPT-1010', 'c0000000-0000-4000-8000-000000000004', 'Optimization', 'Ultra',       'approved',          'med',  'dashboard', 140, 'b000aaaa-0000-4000-8000-000000000003', '2026-06-23', '2026-06-17'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'KW-1007',  'c0000000-0000-4000-8000-000000000005', 'Keyword',      'Pro',         'confirmed',         'med',  'quick',     79,  null,                                   '2026-06-26', '2026-06-22'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'AUD-1009', 'c0000000-0000-4000-8000-000000000006', 'Audit',        'Basic',       'new',               'low',  'quick',     19,  null,                                   '2026-06-27', '2026-06-24')
on conflict (tenant_id, code) do nothing;
