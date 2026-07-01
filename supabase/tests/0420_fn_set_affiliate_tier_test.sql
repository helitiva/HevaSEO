-- Lane E inc-E6: set_affiliate_tier — admin pins tier (override) / reverts to auto.
begin;
select plan(6);

select has_function('set_affiliate_tier', 'set_affiliate_tier() exists');
select ok(not has_function_privilege('anon', 'set_affiliate_tier(uuid,text)', 'execute'), 'anon CANNOT set tier');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');
insert into affiliates(id, tenant_id, user_id, code, tier, status, tier_pinned) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active', false);

set local role authenticated;

-- non-admin cannot change tier
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';
select throws_ok($$ select set_affiliate_tier('eeeeeeee-0000-0000-0000-0000000000f1', 'gold') $$, 'NOT_ADMIN', 'affiliate cannot change its own tier');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
-- pin gold
select set_affiliate_tier('eeeeeeee-0000-0000-0000-0000000000f1', 'gold');
select is((select tier::text from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'gold', 'pin → tier gold');
select ok((select tier_pinned from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'pin → tier_pinned true');
-- revert to auto (null): pin cleared, stored tier kept
select set_affiliate_tier('eeeeeeee-0000-0000-0000-0000000000f1', null);
select ok(not (select tier_pinned from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'revert → tier_pinned false');

reset role;
select * from finish();
rollback;
