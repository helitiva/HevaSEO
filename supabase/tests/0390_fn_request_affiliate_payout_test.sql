-- Lane E inc-E2: request_affiliate_payout — claims-derived, own affiliate, atomic (balance==SUM(ledger)).
begin;
select plan(8);

select has_function('request_affiliate_payout', 'request_affiliate_payout() exists');
select ok(not has_function_privilege('anon', 'request_affiliate_payout(numeric)', 'execute'), 'anon CANNOT request');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer');
insert into affiliates(id, tenant_id, user_id, code, tier, status) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active');
insert into affiliate_commission(affiliate_id, tenant_id, balance) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 200);
insert into commission_ledger(tenant_id, affiliate_id, amount, kind) values
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', 200, 'commission');

set local role authenticated;

-- non-affiliate refused
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select throws_ok($$ select request_affiliate_payout(50) $$, 'NOT_AFFILIATE', 'customer cannot request affiliate payout');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';
-- below min
select throws_ok($$ select request_affiliate_payout(10) $$, 'BELOW_MIN', 'below $50 min rejected');
-- more than balance
select throws_ok($$ select request_affiliate_payout(999) $$, 'INSUFFICIENT_BALANCE', 'over-balance rejected');

-- valid request: balance 200 → 120, payout row 'requested', invariant holds
select request_affiliate_payout(80);
select is((select balance from affiliate_commission where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric, 120::numeric, 'balance debited 200→120');
select is((select count(*) from affiliate_payouts where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1' and status = 'requested')::int, 1, 'requested payout row created');
select is(
  (select balance from affiliate_commission where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric,
  (select sum(amount) from commission_ledger where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric,
  'CRITICAL: balance == SUM(commission_ledger) after payout');

reset role;
select * from finish();
rollback;
