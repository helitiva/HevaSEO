-- Lane E inc-E12/E14: update_affiliate_profile — affiliate edits its OWN name + marketing (claims-derived).
begin;
select plan(6);

select has_function('update_affiliate_profile', 'update_affiliate_profile() exists');
select ok(not has_function_privilege('anon', 'update_affiliate_profile(text,text,text,text)', 'execute'), 'anon CANNOT edit profile');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer');
insert into affiliates(id, tenant_id, user_id, code, tier, status) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active');

set local role authenticated;

-- non-affiliate refused
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select throws_ok($$ select update_affiliate_profile('Nm','X','Y','Z') $$, 'NOT_AFFILIATE', 'customer cannot edit affiliate profile');

-- affiliate edits own → name + fields set
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';
select update_affiliate_profile('Jane R', 'YouTube', 'SEO', '120k subscribers');
select is((select name from profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1'), 'Jane R', 'display name saved to profile');
select is((select platform from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'YouTube', 'platform saved');
select is((select audience from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), '120k subscribers', 'audience saved');

reset role;
select * from finish();
rollback;
