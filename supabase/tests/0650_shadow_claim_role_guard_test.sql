-- SECURITY guard for 20260701450000_privileged_shadow_claim_guard.
-- A bare email match at signup may ONLY hand out a customer identity. A pending privileged shadow
-- (staff/manager/admin/affiliate) must NOT be claimed by open self-signup, and a fresh customer row
-- must NOT be created over a privileged email. Simulates GoTrue by inserting into auth.users (fires
-- on_auth_user_created → handle_new_user).
begin;
select plan(6);

-- agency tenant is created by the handle_new_user migration; add shadows in it.
insert into profiles (tenant_id, email, name, role, status, user_id) values
  ('a9e0c0de-0000-4000-8000-000000000001', 'guard.staff@hevaseo.com',  'Pend Staff', 'staff',    'invited', null),
  ('a9e0c0de-0000-4000-8000-000000000001', 'guard.cust@hevaseo.com',   'Pend Cust',  'customer', 'invited', null);

-- attacker/self signs up with the STAFF invite email → must NOT claim the staff profile
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'guard.staff@hevaseo.com', 'x', now(), '{"name":"Attacker"}'::jsonb, now(), now());

select is((select user_id is null from profiles where email = 'guard.staff@hevaseo.com'), true,
  'CRITICAL: privileged (staff) shadow is NOT claimed by open self-signup');
select is((select role::text from profiles where email = 'guard.staff@hevaseo.com'), 'staff',
  'staff shadow keeps its role (not overwritten to customer)');
select is((select count(*)::int from profiles where email = 'guard.staff@hevaseo.com'), 1,
  'no duplicate customer profile created over the privileged email');

-- a CUSTOMER shadow with the same-email signup → claimed as normal
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'guard.cust@hevaseo.com', 'x', now(), '{"name":"Real Cust"}'::jsonb, now(), now());

select is((select user_id is not null from profiles where email = 'guard.cust@hevaseo.com'), true,
  'a customer shadow IS still claimed by self-signup (onboarding unbroken)');

-- a brand-new email → fresh forced-customer profile
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'guard.new@example.com', 'x', now(), '{"name":"New"}'::jsonb, now(), now());

select is((select count(*)::int from profiles where email = 'guard.new@example.com'), 1,
  'brand-new email → a profile is created');
select is((select role::text from profiles where email = 'guard.new@example.com'), 'customer',
  'brand-new self-signup is forced to customer role');

select * from finish();
rollback;
