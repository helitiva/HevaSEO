-- Lane E inc-E14: set_affiliate_code — affiliate changes its OWN referral code (unique per tenant).
begin;
select plan(6);

select has_function('set_affiliate_code', 'set_affiliate_code() exists');
select ok(not has_function_privilege('anon', 'set_affiliate_code(text)', 'execute'), 'anon CANNOT set code');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f2', '11111111-1111-1111-1111-111111111111', 'aff2@a', 'Aff2', 'affiliate');
insert into affiliates(id, tenant_id, user_id, code, tier, status) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active'),
  ('eeeeeeee-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f2', 'TAKEN', 'bronze', 'active');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';

select throws_ok($$ select set_affiliate_code('ab') $$, 'BAD_CODE', 'too-short code rejected');
select throws_ok($$ select set_affiliate_code('TAKEN') $$, 'CODE_TAKEN', 'duplicate code rejected');
select set_affiliate_code('janeseo');

-- verify as superuser (affiliate RLS would hide the OTHER affiliate's row)
reset role;
select is((select code from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'JANESEO', 'code updated + uppercased');
select is((select code from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f2'), 'TAKEN', 'other affiliate code untouched');

select * from finish();
rollback;
