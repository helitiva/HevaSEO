-- Lane E inc-E10: affiliates can read their tenant's tier ladder (partner-facing terms), tenant-isolated.
begin;
select plan(3);

insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');
insert into affiliate_tier_config(tenant_id, tier, min_volume, rate) values
  ('11111111-1111-1111-1111-111111111111', 'gold', 25000, 0.22),
  ('22222222-2222-2222-2222-222222222222', 'gold', 99999, 0.99);

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';

select is((select count(*) from affiliate_tier_config)::int, 1, 'affiliate sees ONLY its tenant tier rows');
select is((select rate from affiliate_tier_config where tier = 'gold')::numeric, 0.22::numeric, 'reads own-tenant gold rate');
select is((select count(*) from affiliate_tier_config where tenant_id = '22222222-2222-2222-2222-222222222222')::int, 0, 'cannot read another tenant tier config');

reset role;
select * from finish();
rollback;
