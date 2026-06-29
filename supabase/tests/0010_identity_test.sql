-- E0b increment 1: identity spine structure + tenant-isolation RLS.
-- The cross-tenant assertion is one of the CRITICAL security tests (ADR §9).
begin;
select plan(6);

-- structure
select has_table('tenants',  'tenants table exists');
select has_table('profiles', 'profiles table exists');
select has_column('profiles', 'tenant_id', 'profiles.tenant_id exists');
select ok(
  (select relrowsecurity from pg_class where relname = 'profiles'),
  'RLS is enabled on profiles'
);

-- seed as superuser (bypasses RLS)
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');
insert into profiles(tenant_id, email, name, role) values
  ('11111111-1111-1111-1111-111111111111', 'a1@example.com', 'A1', 'staff'),
  ('22222222-2222-2222-2222-222222222222', 'b1@example.com', 'B1', 'staff');

-- act as an authenticated request scoped to Tenant A
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111"}';
select is(
  (select count(*) from profiles)::int, 1,
  'tenant A sees only its own profile (RLS tenant isolation)'
);

-- a request for an unrelated tenant sees nothing (cross-tenant invisible)
set local request.jwt.claims = '{"tenant_id":"33333333-3333-3333-3333-333333333333"}';
select is(
  (select count(*) from profiles)::int, 0,
  'foreign tenant sees zero profiles (cross-tenant = 0 rows)'
);

reset role;
select * from finish();
rollback;
