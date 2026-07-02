-- update_my_profile: a customer edits only their own safe profile columns (never tier); customer-only.
begin;
select plan(6);

select has_function('update_my_profile', 'update_my_profile() exists');
select ok(not has_function_privilege('anon', 'update_my_profile(text,text,text,text,text,jsonb)', 'execute'), 'anon CANNOT update a profile');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-000000000c11', '11111111-1111-1111-1111-111111111111', 'c1@a', 'C1', 'customer'),
  ('aaaaaaaa-0000-0000-0000-000000000f11', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff');
insert into customers(id, tenant_id, name, company, email, status, tier, user_id) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Old Name', 'OldCo', 'c1@a', 'claimed', 'new', 'aaaaaaaa-0000-0000-0000-000000000c11'),
  ('cccccccc-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 'Two', 'TwoCo', 'c2@a', 'claimed', 'new', null);

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';

select update_my_profile('New Name', '+1 555', 'NewCo', 'Retail', 'newco.com', null);

-- a staffer cannot update a profile
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-0000-0000-0000-000000000f11"}';
select throws_ok($$ select update_my_profile('x', null, null, null, null, null) $$, 'NOT_CUSTOMER', 'non-customer cannot update a profile');

-- verify as superuser (RLS would otherwise hide the other customer's row)
reset role;
select is((select name from customers where id = 'cccccccc-0000-0000-0000-0000000000c1'), 'New Name', 'customer updated own name');
select is((select tier::text from customers where id = 'cccccccc-0000-0000-0000-0000000000c1'), 'new', 'tier is NOT touched by the profile update');
select is((select name from customers where id = 'cccccccc-0000-0000-0000-0000000000c2'), 'Two', 'another customer''s row is untouched');
select * from finish();
rollback;
