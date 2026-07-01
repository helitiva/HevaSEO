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

-- Orders are seeded THROUGH the money functions (inc-4c) so each one has a customer_balances row + a
-- debit ledger entry → balance == SUM(ledger) holds, and cancelling a planned seeded order reconciles
-- correctly. topup gives each customer demo credit; create_order debits + creates the order in 'new';
-- then we backfill the demo specifics create_order doesn't set (state/pkg/priority/source/deadline/
-- assignee/created_at). Direct INSERT (the old way) left the money side empty → broken refunds.
do $$
declare
  v_agency constant uuid := 'a9e0c0de-0000-4000-8000-000000000001';
  c record;
  r record;
begin
  -- demo credit per customer: covers their orders and leaves a spendable balance.
  for c in select id from public.customers where tenant_id = v_agency loop
    perform topup(v_agency, c.id, 1000, null);
  end loop;

  for r in
    select * from (values
      -- code, customer, service, pkg, state, priority, source, value, assignee('' = none), deadline, created
      ('AUD-1001', 'c0000000-0000-4000-8000-000000000001', 'Audit',        'Standard',    'new',               'high', 'quick',     39,  '',                                     '2026-06-26', '2026-06-24'),
      ('CNT-1004', 'c0000000-0000-4000-8000-000000000001', 'Content',      '10 articles', 'delivered',         'med',  'quick',     120, '',                                     '2026-06-27', '2026-06-20'),
      ('KW-1013',  'c0000000-0000-4000-8000-000000000001', 'Keyword',      'Standard',    'completed',         'med',  'dashboard', 39,  'b000aaaa-0000-4000-8000-000000000003', '2026-06-19', '2026-06-13'),
      ('KW-1002',  'c0000000-0000-4000-8000-000000000002', 'Keyword',      'Standard',    'in_progress',       'med',  'dashboard', 39,  'b000aaaa-0000-4000-8000-000000000003', '2026-06-25', '2026-06-23'),
      ('BL-1014',  'c0000000-0000-4000-8000-000000000002', 'Backlink',     'Starter',     'changes_requested', 'high', 'quick',     36,  '',                                     '2026-06-24', '2026-06-12'),
      ('BL-1003',  'c0000000-0000-4000-8000-000000000003', 'Backlink',     'Growth',      'internal_review',   'high', 'dashboard', 64,  '',                                     '2026-06-24', '2026-06-21'),
      ('BL-1006',  'c0000000-0000-4000-8000-000000000003', 'Backlink',     'Power',       'assigned',          'high', 'dashboard', 104, 'b000aaaa-0000-4000-8000-000000000003', '2026-06-28', '2026-06-22'),
      ('OPT-1005', 'c0000000-0000-4000-8000-000000000004', 'Optimization', 'Standard',    'completed',         'low',  'dashboard', 79,  'b000aaaa-0000-4000-8000-000000000003', '2026-06-22', '2026-06-18'),
      ('OPT-1010', 'c0000000-0000-4000-8000-000000000004', 'Optimization', 'Ultra',       'approved',          'med',  'dashboard', 140, 'b000aaaa-0000-4000-8000-000000000003', '2026-06-23', '2026-06-17'),
      ('KW-1007',  'c0000000-0000-4000-8000-000000000005', 'Keyword',      'Pro',         'confirmed',         'med',  'quick',     79,  '',                                     '2026-06-26', '2026-06-22'),
      ('AUD-1009', 'c0000000-0000-4000-8000-000000000006', 'Audit',        'Basic',       'new',               'low',  'quick',     19,  '',                                     '2026-06-27', '2026-06-24')
    ) as t(code, cust, service, pkg, state, priority, source, value, assignee, deadline, created)
  loop
    perform create_order(v_agency, r.cust::uuid, r.code, r.service, r.value, null);
    update public.orders
       set pkg         = r.pkg,
           priority    = r.priority::order_priority,
           source      = r.source::order_source,
           deadline    = r.deadline::timestamptz,
           assignee_id = nullif(r.assignee, '')::uuid,
           created_at  = r.created::timestamptz,
           state       = r.state::order_state
     where tenant_id = v_agency and code = r.code;
  end loop;
end $$;

-- Lane A inc-3g — staff roster: profiles for the team (Mai already seeded as a demo account) + a
-- staff_details row each (skills/capacity/role/tz/tenure + perf metrics). Names match the order
-- assignee strings so per-staff workload resolves. Pay/wallet stays in the gated Lane D domain.
insert into public.profiles (id, tenant_id, user_id, email, name, role, status) values
  ('b000bbbb-0000-4000-8000-000000000001', 'a9e0c0de-0000-4000-8000-000000000001', null, 'linh@hevaseo.com',  'Linh P.',  'staff', 'invited'),
  ('b000bbbb-0000-4000-8000-000000000002', 'a9e0c0de-0000-4000-8000-000000000001', null, 'huy@hevaseo.com',   'Huy N.',   'staff', 'invited'),
  ('b000bbbb-0000-4000-8000-000000000003', 'a9e0c0de-0000-4000-8000-000000000001', null, 'diego@hevaseo.com', 'Diego R.', 'staff', 'invited'),
  ('b000bbbb-0000-4000-8000-000000000004', 'a9e0c0de-0000-4000-8000-000000000001', null, 'aria@hevaseo.com',  'Aria K.',  'staff', 'invited'),
  ('b000bbbb-0000-4000-8000-000000000005', 'a9e0c0de-0000-4000-8000-000000000001', null, 'tom@hevaseo.com',   'Tom B.',   'staff', 'invited')
on conflict (tenant_id, email) do nothing;

-- profile_id, skills, capacity, role_label, timezone, since, active, composite, quality, on_time, throughput, trend
insert into public.staff_details (tenant_id, profile_id, skills, capacity, role_label, timezone, since, active, composite, quality, on_time, throughput, trend) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'b000aaaa-0000-4000-8000-000000000003', '{keyword,optimize,content}', 6, 'Senior SEO Specialist', 'GMT+7', '2023-02-14', true,  92, 95, 90, 22, '{2,3,4,3,5,4,6,5}'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'b000bbbb-0000-4000-8000-000000000001', '{backlink,keyword}',        5, 'Backlink Specialist',   'GMT+7', '2023-06-01', true,  88, 86, 92, 31, '{3,4,5,4,6,5,7,6}'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'b000bbbb-0000-4000-8000-000000000002', '{content,optimize}',        8, 'Content Lead',          'GMT+7', '2022-11-20', true,  84, 88, 79, 40, '{4,5,6,5,7,6,8,7}'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'b000bbbb-0000-4000-8000-000000000003', '{content,optimize}',        7, 'Content Specialist',    'GMT-3', '2024-01-10', true,  86, 90, 85, 28, '{3,3,4,4,5,4,6,5}'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'b000bbbb-0000-4000-8000-000000000004', '{keyword,backlink}',        6, 'SEO Analyst',           'GMT+2', '2024-03-22', true,  90, 92, 88, 26, '{2,3,3,4,4,5,5,6}'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'b000bbbb-0000-4000-8000-000000000005', '{backlink,content}',        5, 'Link Builder',          'GMT+0', '2023-09-05', false, 82, 84, 80, 34, '{4,4,5,5,6,5,7,6}')
on conflict (profile_id) do nothing;

-- Lane D inc-D6 — pod link: Mai reports to Sofia (manager), so post_staff_pay cascades a pod-override
-- commission into Sofia's wallet (managers earn on their pod's gig + commission). Set before the
-- commission seeding below so the cascade fires.
update public.staff_details set manager_id = 'b000aaaa-0000-4000-8000-000000000002'
 where profile_id = 'b000aaaa-0000-4000-8000-000000000003';

-- Step 2 inc-5a — order_details (brief/project/folder/included) for each seeded order, keyed by code.
do $$
declare
  v_agency constant uuid := 'a9e0c0de-0000-4000-8000-000000000001';
  r record;
begin
  for r in
    select * from (values
      ('AUD-1001', 'Acme — SEO program',   'Audits',   '[{"label":"Website","value":"https://acme.co"},{"label":"Goal","value":"Improve organic visibility"}]', '{"Technical audit","Action report"}'),
      ('CNT-1004', 'Acme — SEO program',   'Content',  '[{"label":"Website","value":"https://acme.co"},{"label":"Topics","value":"10 articles, money pages"}]', '{"Article drafts","On-page SEO"}'),
      ('KW-1013',  'Acme — SEO program',   'Research', '[{"label":"Website","value":"https://acme.co"},{"label":"Market","value":"US · English"}]',           '{"Keyword map","Search intent"}'),
      ('KW-1002',  'Bright — SEO program', 'Research', '[{"label":"Website","value":"https://bright.co"},{"label":"Market","value":"UK"}]',                    '{"Keyword map","Search intent"}'),
      ('BL-1014',  'Bright — SEO program', 'Backlinks','[{"label":"Website","value":"https://bright.co"},{"label":"Anchors","value":"Branded + partial"}]',    '{"Link prospects","Outreach"}'),
      ('BL-1003',  'Nova — SEO program',   'Backlinks','[{"label":"Website","value":"https://nova.io"},{"label":"Anchors","value":"Mixed"}]',                  '{"Link prospects","Outreach"}'),
      ('BL-1006',  'Nova — SEO program',   'Backlinks','[{"label":"Website","value":"https://nova.io"},{"label":"Volume","value":"High"}]',                    '{"Link prospects","Outreach"}'),
      ('OPT-1005', 'Vértice — SEO program','Optimize', '[{"label":"Website","value":"https://vertice.es"},{"label":"Focus","value":"Core Web Vitals"}]',        '{"On-page fixes","Speed"}'),
      ('OPT-1010', 'Vértice — SEO program','Optimize', '[{"label":"Website","value":"https://vertice.es"},{"label":"Focus","value":"Conversion pages"}]',       '{"On-page fixes","Speed"}'),
      ('KW-1007',  'Peak — SEO program',   'Research', '[{"label":"Website","value":"https://peak.dig"},{"label":"Market","value":"US"}]',                      '{"Keyword map","Search intent"}'),
      ('AUD-1009', 'Lumen — SEO program',  'Audits',   '[{"label":"Website","value":"https://lumen.co"},{"label":"Goal","value":"Baseline health"}]',           '{"Technical audit","Action report"}')
    ) as t(code, project, folder, brief, included)
  loop
    insert into public.order_details (tenant_id, order_id, project, folder, brief, included)
    select v_agency, o.id, r.project, r.folder, r.brief::jsonb, r.included::text[]
    from public.orders o
    where o.tenant_id = v_agency and o.code = r.code
    on conflict (order_id) do nothing;
  end loop;
end $$;

-- Step 2 inc-5c — order_addons (paid upsells) on a few orders, keyed by code.
insert into public.order_addons (tenant_id, order_id, name, tier, price)
select 'a9e0c0de-0000-4000-8000-000000000001', o.id, x.name, x.tier, x.price
from (values
  ('CNT-1004', 'Express delivery', 'pro',      40),
  ('CNT-1004', 'Extra revisions',  'standard', 20),
  ('OPT-1010', 'Priority support', 'pro',      30)
) as x(code, name, tier, price)
join public.orders o on o.tenant_id = 'a9e0c0de-0000-4000-8000-000000000001' and o.code = x.code;

-- Step 2 inc-5d — assignment_rules (routing config): pin Backlink → Linh; Content auto-routes.
insert into public.assignment_rules (tenant_id, service, pkg, mode, target_staff_id) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'Backlink', null, 'pin',  'b000bbbb-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'Content',  null, 'auto', null);

-- Step 2 inc-5e — deliverables for the review board: a queue item (latest 'submitted'), a resubmission
-- (v1 changes_requested + v2 submitted), an approved one (stats), and a sent-back one.
insert into public.deliverables (tenant_id, order_id, submitter_id, version, status, summary, files, submitted_at, reviewed_at, review_note)
select 'a9e0c0de-0000-4000-8000-000000000001', o.id, x.submitter::uuid, x.version, x.status::deliverable_status,
       x.summary, x.files::jsonb, x.submitted::timestamptz, nullif(x.reviewed, '')::timestamptz, nullif(x.review_note, '')
from (values
  ('BL-1003',  'b000bbbb-0000-4000-8000-000000000001', 1, 'submitted',         'Nova — link prospects batch 1',     '[{"kind":"file","fileName":"nova-links-v1.xlsx","url":null}]',        '2026-06-23', '',           ''),
  ('CNT-1004', 'b000bbbb-0000-4000-8000-000000000002', 1, 'changes_requested', 'First draft — 5 posts',             '[{"kind":"file","fileName":"acme-blog-v1.docx","url":null}]',         '2026-06-22', '2026-06-23', 'Add internal links and meta titles/descriptions.'),
  ('CNT-1004', 'b000bbbb-0000-4000-8000-000000000002', 2, 'submitted',         'Added internal links + meta',       '[{"kind":"file","fileName":"acme-blog-v2.docx","url":null}]',         '2026-06-24', '',           ''),
  ('KW-1013',  'b000aaaa-0000-4000-8000-000000000003', 1, 'approved',          'Keyword map + search intent',       '[{"kind":"link","fileName":null,"url":"https://docs.example/kw-1013"}]', '2026-06-18', '2026-06-19', ''),
  ('BL-1014',  'b000bbbb-0000-4000-8000-000000000001', 1, 'changes_requested', 'Starter links — first batch',       '[{"kind":"file","fileName":"bright-links.xlsx","url":null}]',         '2026-06-23', '2026-06-24', 'Anchor profile too exact-match.')
) as x(code, submitter, version, status, summary, files, submitted, reviewed, review_note)
join public.orders o on o.tenant_id = 'a9e0c0de-0000-4000-8000-000000000001' and o.code = x.code;

-- Lane D inc-D1 — seed staff commission wallets via the real post_staff_pay fn (same path the app
-- will use), so the demo staffer (Mai) has a wallet balance + ledger. Commission = 30% of order value
-- (money-leak-safe: a derived figure, not the order price), gig = 0. Runs on Mai's done/approved orders.
-- (No manager override cascade: staff_details.manager_id is unset in this seed.)
do $$
declare r record;
begin
  for r in
    select o.id, round(o.value * 0.30, 2) as commission
    from public.orders o
    where o.tenant_id = 'a9e0c0de-0000-4000-8000-000000000001'
      and o.assignee_id = 'b000aaaa-0000-4000-8000-000000000003'   -- Mai
      and o.state in ('completed', 'approved')
  loop
    perform post_staff_pay(r.id, 'b000aaaa-0000-4000-8000-000000000003', r.commission, 0, 'b000aaaa-0000-4000-8000-000000000001');
  end loop;
end $$;

-- Lane D inc-D3 — a default payout method for Mai so she can request a real payout from her wallet.
insert into public.staff_payout_methods (tenant_id, staff_id, kind, detail, is_default) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'b000aaaa-0000-4000-8000-000000000003', 'paypal', 'mai@paypal.me', true)
on conflict do nothing;

-- Lane C inc-C1 — docs distributed to audiences (array-RLS). body jsonb carries the rich metadata
-- (summary/format/tags/author/readMins/blocks); top-level audiences[]/required_skills[] drive RLS.
insert into public.docs (tenant_id, title, body, audiences, required_skills, pinned, author_id) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'Getting started with your dashboard',
   '{"summary":"A quick tour of orders, credit and reports.","format":"guide","tags":["start-here","dashboard"],"author":"HevaSEO","readMins":4,"blocks":[{"type":"p","text":"Welcome! Track every order live, top up credit, and download reports from your dashboard."},{"type":"ul","items":["Place an order from Browse services","Top up credit anytime","Get reports two ways"]}],"resources":[]}',
   '{customer}', '{}', true, 'b000aaaa-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'How we report results',
   '{"summary":"What your monthly SEO report covers.","format":"guide","tags":["reports"],"author":"HevaSEO","readMins":3,"blocks":[{"type":"p","text":"Each report covers rankings, traffic, and the work delivered."}],"resources":[]}',
   '{customer}', '{}', false, 'b000aaaa-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'Staff handbook & onboarding',
   '{"summary":"Start-here guide for the delivery team.","format":"policy","tags":["onboarding"],"author":"Ops","readMins":6,"blocks":[{"type":"p","text":"Admin confirms an order and routes it to your board based on your skills."}],"resources":[]}',
   '{staff,manager}', '{}', true, 'b000aaaa-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'Backlink outreach SOP',
   '{"summary":"Step-by-step backlink prospecting + outreach.","format":"sop","tags":["backlink"],"author":"Ops","readMins":8,"blocks":[{"type":"p","text":"Only shown to staff whose skills include backlink."}],"resources":[]}',
   '{staff}', '{backlink}', false, 'b000aaaa-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'Keyword research playbook',
   '{"summary":"How we cluster + prioritise keywords.","format":"guide","tags":["keyword"],"author":"Ops","readMins":5,"blocks":[{"type":"p","text":"Only shown to staff whose skills include keyword."}],"resources":[]}',
   '{staff}', '{keyword}', false, 'b000aaaa-0000-4000-8000-000000000001');

-- Lane C inc-C4 — real broadcasts across audiences/kinds (recipients read these via getMyBroadcasts).
-- display_kind = the UI tone; banner = also pop an overview banner; status 'live' = delivered now.
insert into public.broadcasts (tenant_id, title, body, display_kind, audiences, banner, pinned, status, cta, created_by_id) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'Welcome to the new dashboard', 'We refreshed your dashboard — orders, credit and reports in one place.', 'notice', '{customer}', false, true, 'live', null, 'b000aaaa-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'Summer credit bonus', 'Top up $500+ this month and get 5% extra credit.', 'congrats', '{customer}', true, false, 'live', '{"label":"Top up now","href":"/credit"}', 'b000aaaa-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'New QA checklist live', 'All deliverables now run through the updated QA checklist before sign-off.', 'info', '{staff,manager}', false, false, 'live', null, 'b000aaaa-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'Scheduled maintenance Sat 02:00 UTC', 'The platform will be briefly unavailable during a maintenance window.', 'maintenance', '{customer,staff,manager,affiliate}', true, false, 'live', null, 'b000aaaa-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'Q2 commission tiers updated', 'Affiliate commission tiers were revised for Q2 — see your dashboard.', 'info', '{affiliate}', false, false, 'live', null, 'b000aaaa-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'Old promo (recalled)', 'This message was recalled and should not appear.', 'notice', '{customer}', false, false, 'recalled', null, 'b000aaaa-0000-4000-8000-000000000001');

-- Lane C inc-C6 — a few real read/click events so broadcast analytics aren't empty in the demo.
-- Jane (customer) read Welcome + read & clicked Summer credit bonus; Mai (staff) read the QA checklist.
insert into public.broadcast_events (tenant_id, broadcast_id, user_id, kind)
  select b.tenant_id, b.id, 'b000aaaa-0000-4000-8000-000000000004'::uuid, 'read'
    from public.broadcasts b where b.title = 'Welcome to the new dashboard'
  union all
  select b.tenant_id, b.id, 'b000aaaa-0000-4000-8000-000000000004'::uuid, 'read'
    from public.broadcasts b where b.title = 'Summer credit bonus'
  union all
  select b.tenant_id, b.id, 'b000aaaa-0000-4000-8000-000000000004'::uuid, 'click'
    from public.broadcasts b where b.title = 'Summer credit bonus'
  union all
  select b.tenant_id, b.id, 'b000aaaa-0000-4000-8000-000000000003'::uuid, 'read'
    from public.broadcasts b where b.title = 'New QA checklist live';

-- Lane D polish — a couple of posted payroll runs for Mai so her Payslips tab shows real fixed pay
-- (salary + gig + bonus per period). Commission stays in the wallet (Activity/Payouts), not here.
insert into public.payroll_runs (tenant_id, staff_id, period, salary, gig, bonus, total) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'b000aaaa-0000-4000-8000-000000000003', '2026-05', 1300, 48, 0, 1348),
  ('a9e0c0de-0000-4000-8000-000000000001', 'b000aaaa-0000-4000-8000-000000000003', '2026-06', 1300, 66, 50, 1416)
on conflict (tenant_id, staff_id, period) do nothing;

-- Lane E inc-E1 — Jane (affiliate demo account, profile ...05) as a real affiliate with referrals +
-- commission ledger + a payout. balance == SUM(commission_ledger) (K11 invariant): +120+80+40−100 = 140.
insert into public.affiliates (id, tenant_id, user_id, code, tier, status, joined_at, platform, niche, audience, clicks) values
  ('e0000000-0000-4000-8000-000000000001', 'a9e0c0de-0000-4000-8000-000000000001', 'b000aaaa-0000-4000-8000-000000000005', 'JANESEO', 'gold', 'active', '2025-11-01', 'YouTube', 'SEO & Marketing', '120k subscribers', 480)
on conflict do nothing;
insert into public.affiliate_referrals (id, tenant_id, affiliate_id, customer_id, volume, status) values
  ('e1000000-0000-4000-8000-000000000001', 'a9e0c0de-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 600, 'active'),
  ('e1000000-0000-4000-8000-000000000002', 'a9e0c0de-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 400, 'active'),
  ('e1000000-0000-4000-8000-000000000003', 'a9e0c0de-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 200, 'churned');
insert into public.commission_ledger (tenant_id, affiliate_id, amount, kind, referral_id) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 120, 'commission', 'e1000000-0000-4000-8000-000000000001'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 80,  'commission', 'e1000000-0000-4000-8000-000000000002'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 40,  'commission', 'e1000000-0000-4000-8000-000000000003'),
  ('a9e0c0de-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', -100, 'payout', null);
insert into public.affiliate_commission (affiliate_id, tenant_id, balance) values
  ('e0000000-0000-4000-8000-000000000001', 'a9e0c0de-0000-4000-8000-000000000001', 140)
on conflict (affiliate_id) do update set balance = excluded.balance;
insert into public.affiliate_payouts (tenant_id, affiliate_id, amount, status, resolved_at) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 100, 'paid', now());

-- Analytics: support tickets (SupportStats). Statuses across the enum; a few replied today (2026-06-24)
-- for "answered today"; last_reply_at drives avg first-response. Customers c...01–04, handler Mai.
insert into public.tickets (tenant_id, code, subject, customer_id, type, channel, status, priority, assignee_id, sla_tier, created_at, last_reply_at) values
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2001','Cannot access report',      'c0000000-0000-4000-8000-000000000001','technical','portal','open',    'high','b000aaaa-0000-4000-8000-000000000003','urgent',   '2026-06-24T06:00:00Z', null),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2002','Invoice question',          'c0000000-0000-4000-8000-000000000002','billing',  'email', 'open',    'med', 'b000aaaa-0000-4000-8000-000000000003','standard', '2026-06-23T09:00:00Z', null),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2003','Keyword strategy call',     'c0000000-0000-4000-8000-000000000003','consultation','whatsapp','pending','med','b000aaaa-0000-4000-8000-000000000003','standard','2026-06-22T10:00:00Z','2026-06-24T08:00:00Z'),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2004','Change target URL',         'c0000000-0000-4000-8000-000000000001','technical','portal','pending', 'low', 'b000aaaa-0000-4000-8000-000000000003','standard', '2026-06-21T12:00:00Z','2026-06-24T09:30:00Z'),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2005','Refund request',            'c0000000-0000-4000-8000-000000000004','billing',  'email', 'pending', 'high','b000aaaa-0000-4000-8000-000000000003','urgent',   '2026-06-20T08:00:00Z','2026-06-23T15:00:00Z'),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2006','Great work — thanks',       'c0000000-0000-4000-8000-000000000001','consultation','portal','resolved','low','b000aaaa-0000-4000-8000-000000000003','standard','2026-06-18T10:00:00Z','2026-06-19T11:00:00Z'),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2007','Report format tweak',       'c0000000-0000-4000-8000-000000000002','technical','portal','resolved','med','b000aaaa-0000-4000-8000-000000000003','standard','2026-06-17T09:00:00Z','2026-06-17T14:00:00Z'),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2008','Upgrade package',           'c0000000-0000-4000-8000-000000000003','billing',  'portal','resolved','med','b000aaaa-0000-4000-8000-000000000003','standard','2026-06-16T11:00:00Z','2026-06-16T13:00:00Z'),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2009','Onboarding help',           'c0000000-0000-4000-8000-000000000004','consultation','messenger','closed','low','b000aaaa-0000-4000-8000-000000000003','standard','2026-06-10T09:00:00Z','2026-06-11T10:00:00Z'),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2010','Password reset',            'c0000000-0000-4000-8000-000000000001','technical','email', 'closed','low','b000aaaa-0000-4000-8000-000000000003','standard','2026-06-09T08:00:00Z','2026-06-09T08:30:00Z'),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2011','Billing address update',    'c0000000-0000-4000-8000-000000000002','billing',  'portal','closed','low','b000aaaa-0000-4000-8000-000000000003','standard','2026-06-08T10:00:00Z','2026-06-08T12:00:00Z'),
  ('a9e0c0de-0000-4000-8000-000000000001','TK-2012','Extra backlinks?',          'c0000000-0000-4000-8000-000000000003','consultation','whatsapp','closed','med','b000aaaa-0000-4000-8000-000000000003','standard','2026-06-05T09:00:00Z','2026-06-06T09:00:00Z');

-- Analytics(geo): tag the demo customers with countries (numeric ISO) so GeoPanel aggregates real.
update public.customers set country_iso = '840' where id = 'c0000000-0000-4000-8000-000000000001'; -- US
update public.customers set country_iso = '826' where id = 'c0000000-0000-4000-8000-000000000002'; -- UK
update public.customers set country_iso = '276' where id = 'c0000000-0000-4000-8000-000000000003'; -- DE
update public.customers set country_iso = '124' where id = 'c0000000-0000-4000-8000-000000000004'; -- CA
update public.customers set country_iso = '356' where id = 'c0000000-0000-4000-8000-000000000005'; -- IN
update public.customers set country_iso = '036' where id = 'c0000000-0000-4000-8000-000000000006'; -- AU
