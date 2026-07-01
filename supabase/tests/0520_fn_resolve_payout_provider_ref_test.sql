-- Lane E inc-E20: resolve_affiliate_payout stores the Stripe transfer id (provider_ref) on 'pay'.
begin;
select plan(4);

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');
insert into affiliates(id, tenant_id, user_id, code, tier, status) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active');
insert into affiliate_commission(affiliate_id, tenant_id, balance) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 0);
insert into affiliate_payouts(id, tenant_id, affiliate_id, amount, status) values
  ('dddddddd-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', 100, 'approved'),
  ('dddddddd-0000-0000-0000-0000000000d2', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', 50, 'requested');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';

-- pay with a transfer ref
select resolve_affiliate_payout('dddddddd-0000-0000-0000-0000000000d1', 'pay', 'tr_test_123');
select is((select status from affiliate_payouts where id = 'dddddddd-0000-0000-0000-0000000000d1'), 'paid', 'marked paid');
select is((select provider_ref from affiliate_payouts where id = 'dddddddd-0000-0000-0000-0000000000d1'), 'tr_test_123', 'transfer id stored');
-- idempotent: re-pay blocked
select throws_ok($$ select resolve_affiliate_payout('dddddddd-0000-0000-0000-0000000000d1', 'pay', 'tr_x') $$, 'ALREADY_RESOLVED', 're-pay blocked');
-- back-compat: 2-arg call still works (provider_ref defaults null) on a fresh request
select lives_ok($$ select resolve_affiliate_payout('dddddddd-0000-0000-0000-0000000000d2', 'approve') $$, '2-arg call (no provider_ref) still works');

reset role;
select * from finish();
rollback;
