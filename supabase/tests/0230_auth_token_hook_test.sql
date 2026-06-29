-- E0a+ PoC: the custom-access-token hook injects tenant_id/app_role/profile_id into the JWT claims
-- that RLS reads. A user with no profile gets no custom claims (anon-safe).
begin;
select plan(5);

select has_function('custom_access_token_hook', 'custom_access_token_hook() exists');

-- a profile linked to an auth user
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, user_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999999', 'u@a.com', 'U', 'staff');

-- the event GoTrue passes for that auth user
select is(
  (custom_access_token_hook('{"user_id":"99999999-9999-9999-9999-999999999999","claims":{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}}'::jsonb) -> 'claims' ->> 'tenant_id'),
  '11111111-1111-1111-1111-111111111111', 'hook injects tenant_id into JWT claims');
select is(
  (custom_access_token_hook('{"user_id":"99999999-9999-9999-9999-999999999999","claims":{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}}'::jsonb) -> 'claims' ->> 'app_role'),
  'staff', 'hook injects app_role');
select is(
  (custom_access_token_hook('{"user_id":"99999999-9999-9999-9999-999999999999","claims":{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}}'::jsonb) -> 'claims' ->> 'profile_id'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'hook injects profile_id');

-- an auth user with no profile gets no custom claims (so RLS sees nothing → 0 rows)
select is(
  (custom_access_token_hook('{"user_id":"00000000-0000-0000-0000-000000000000","claims":{"role":"authenticated"}}'::jsonb) -> 'claims' ->> 'tenant_id'),
  null, 'no profile → no custom claims (anon-safe)');

select * from finish();
rollback;
