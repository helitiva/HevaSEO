-- Lane E inc-E3: resolve_affiliate_payout — admin approve/pay/reject; reject refunds (balance==SUM).
begin;
select plan(8);

select has_function('resolve_affiliate_payout', 'resolve_affiliate_payout() exists');
select ok(not has_function_privilege('anon', 'resolve_affiliate_payout(uuid,text,text)', 'execute'), 'anon CANNOT resolve');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');
insert into affiliates(id, tenant_id, user_id, code, tier, status) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active');
-- Setup (as owner): +200 commission, two payout requests already debited ($80 + $40) → balance 80,
-- ledger SUM = 200 − 80 − 40 = 80. Both payouts 'requested'.
insert into affiliate_commission(affiliate_id, tenant_id, balance) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 80);
insert into commission_ledger(tenant_id, affiliate_id, amount, kind) values
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', 200, 'commission'),
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', -80, 'payout'),
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', -40, 'payout');
insert into affiliate_payouts(id, tenant_id, affiliate_id, amount, status) values
  ('dddddddd-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', 80, 'requested'),
  ('dddddddd-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', 40, 'requested');

set local role authenticated;

-- non-admin cannot resolve
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';
select throws_ok($$ select resolve_affiliate_payout('dddddddd-0000-0000-0000-0000000000f1', 'pay') $$, 'NOT_ADMIN', 'affiliate cannot resolve own payout');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
-- approve → pay payout1 (no balance change)
select resolve_affiliate_payout('dddddddd-0000-0000-0000-0000000000f1', 'approve');
select is((select status from affiliate_payouts where id = 'dddddddd-0000-0000-0000-0000000000f1'), 'approved', 'approve → approved');
select resolve_affiliate_payout('dddddddd-0000-0000-0000-0000000000f1', 'pay');
select is((select status from affiliate_payouts where id = 'dddddddd-0000-0000-0000-0000000000f1'), 'paid', 'pay → paid');
select is((select balance from affiliate_commission where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric, 80::numeric, 'approve/pay do not change balance');
-- cannot re-resolve a paid request
select throws_ok($$ select resolve_affiliate_payout('dddddddd-0000-0000-0000-0000000000f1', 'reject') $$, 'ALREADY_RESOLVED', 'paid payout cannot be re-resolved');

-- reject payout2 → refunds balance (80→120) + ledger adjustment; invariant holds
select resolve_affiliate_payout('dddddddd-0000-0000-0000-0000000000f2', 'reject');
select is(
  (select balance from affiliate_commission where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric,
  (select sum(amount) from commission_ledger where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric,
  'CRITICAL: reject refunds → balance == SUM(commission_ledger)');

reset role;
select * from finish();
rollback;
