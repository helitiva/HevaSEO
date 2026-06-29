-- Lane A inc-2 (auth session): the on_auth_user_created trigger provisions a profiles row when
-- GoTrue creates an auth user. Two paths:
--   (1) LINK   — an existing shadow profile (admin-provisioned, user_id IS NULL) in the agency tenant
--                with the same email is claimed (user_id set); role/entity wiring preserved.
--   (2) CREATE — a self-signup with no shadow gets a fresh profile, FORCED to customer/agency.
-- SECURITY: signup metadata (role/tenant_id) is client-controlled and MUST be ignored — a malicious
-- signup passing role=admin / a foreign tenant must still land as a plain customer in the agency.
-- Uses the migration-seeded agency tenant (never re-creates it) and rolls back, so it can't collide
-- with the committed demo seed (gotcha: never insert a shared tenant id outside a rolled-back txn).
begin;
select plan(7);

select has_function('handle_new_user', 'handle_new_user() trigger fn exists');

-- ── path (1): claim an existing shadow profile in the agency tenant ─────────────
insert into profiles(id, tenant_id, user_id, email, name, role) values
  ('33333333-3333-3333-3333-3333000000a1', 'a9e0c0de-0000-4000-8000-000000000001',
   null, 'shadow@test.co', 'Shadow Staff', 'staff');

insert into auth.users(id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('33333333-3333-3333-3333-3333aaaa0001', 'authenticated', 'authenticated', 'shadow@test.co',
   '{"role":"customer","name":"Ignored"}'::jsonb, now(), now());

select is(
  (select user_id from profiles where id = '33333333-3333-3333-3333-3333000000a1'),
  '33333333-3333-3333-3333-3333aaaa0001'::uuid,
  'shadow profile is claimed (user_id linked) by matching agency+email');
select is(
  (select role from profiles where id = '33333333-3333-3333-3333-3333000000a1'),
  'staff'::app_role,
  'claim preserves the existing role (metadata role is ignored on link)');
select is(
  (select count(*) from profiles where tenant_id = 'a9e0c0de-0000-4000-8000-000000000001' and email = 'shadow@test.co'),
  1::bigint,
  'claim links in place — no duplicate profile created');

-- ── path (2): self-signup with HOSTILE metadata (role=admin, foreign tenant) ────
insert into auth.users(id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('33333333-3333-3333-3333-3333bbbb0002', 'authenticated', 'authenticated', 'attacker@test.co',
   '{"role":"admin","tenant_id":"11111111-1111-1111-1111-111111111111","name":"Mallory"}'::jsonb,
   now(), now());

select is(
  (select role from profiles where user_id = '33333333-3333-3333-3333-3333bbbb0002'),
  'customer'::app_role,
  'self-signup is forced to customer — hostile metadata role=admin is ignored (no escalation)');
select is(
  (select tenant_id from profiles where user_id = '33333333-3333-3333-3333-3333bbbb0002'),
  'a9e0c0de-0000-4000-8000-000000000001'::uuid,
  'self-signup is forced into the agency tenant — hostile metadata tenant_id is ignored');
select is(
  (select count(*) from profiles where tenant_id = '11111111-1111-1111-1111-111111111111' and email = 'attacker@test.co'),
  0::bigint,
  'no profile leaks into the foreign tenant named in metadata');

select * from finish();
rollback;
