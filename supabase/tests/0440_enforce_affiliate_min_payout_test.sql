-- Lane E inc-E8: request_affiliate_payout enforces affiliate_program_config.min_payout (not the hardcoded
-- default). 0390 covers the default-50 path (no config row); this covers a configured min overriding it.
begin;
select plan(3);

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');
insert into affiliates(id, tenant_id, user_id, code, tier, status) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active');
insert into affiliate_commission(affiliate_id, tenant_id, balance) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 500);
insert into commission_ledger(tenant_id, affiliate_id, amount, kind) values
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', 500, 'commission');
-- program config raises min_payout to 200 (seeded before the role switch — table is SELECT-only)
insert into affiliate_program_config(tenant_id, min_payout) values ('11111111-1111-1111-1111-111111111111', 200);

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';

-- $150 would clear the default $50, but the configured min is $200 → rejected
select throws_ok($$ select request_affiliate_payout(150) $$, 'BELOW_MIN', 'config min_payout ($200) enforced over default $50');
-- $250 clears the configured min → succeeds
select request_affiliate_payout(250);
select is((select balance from affiliate_commission where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric, 250::numeric, 'balance debited 500→250 at configured min');
select is(
  (select balance from affiliate_commission where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric,
  (select sum(amount) from commission_ledger where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric,
  'CRITICAL: balance == SUM(commission_ledger)');

reset role;
select * from finish();
rollback;
