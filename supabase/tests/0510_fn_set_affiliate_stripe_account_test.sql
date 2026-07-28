-- Lane E inc-E19: set_affiliate_stripe_account — affiliate links its OWN Stripe Connect account.
begin;
select plan(5);

select has_function('set_affiliate_stripe_account', 'set_affiliate_stripe_account() exists');
select ok(not has_function_privilege('anon', 'set_affiliate_stripe_account(text,boolean)', 'execute'), 'anon CANNOT link account');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer');
insert into affiliates(id, tenant_id, user_id, code, tier, status) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active');

set local role authenticated;

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select throws_ok($$ select set_affiliate_stripe_account('acct_x', true) $$, 'NOT_AFFILIATE', 'customer cannot link account');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';
select set_affiliate_stripe_account('acct_test_123', false);
select is((select stripe_account_id from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'acct_test_123', 'account id stored');
-- onboarding completes → payouts enabled
select set_affiliate_stripe_account('acct_test_123', true);
select ok((select stripe_payouts_enabled from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'payouts_enabled set true');

reset role;
select * from finish();
rollback;
