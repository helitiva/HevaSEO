-- Lane E inc-E22: webhook backstop fns — sync Connect status + reverse a paid payout (refund, idempotent).
begin;
select plan(8);

select has_function('sync_stripe_account_status', 'sync_stripe_account_status() exists');
select has_function('revert_affiliate_payout_by_transfer', 'revert_affiliate_payout_by_transfer() exists');
select ok(not has_function_privilege('authenticated', 'sync_stripe_account_status(text,boolean)', 'execute'), 'authenticated CANNOT call (service_role only)');
select ok(not has_function_privilege('anon', 'revert_affiliate_payout_by_transfer(text)', 'execute'), 'anon CANNOT reverse');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');
insert into affiliates(id, tenant_id, user_id, code, tier, status, stripe_account_id) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active', 'acct_test_9');
insert into affiliate_commission(affiliate_id, tenant_id, balance) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 0);
-- a paid payout backed by a transfer (its debit already left the balance at request time)
insert into affiliate_payouts(id, tenant_id, affiliate_id, amount, status, provider_ref) values
  ('dddddddd-0000-0000-0000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-0000000000f1', 100, 'paid', 'tr_test_9');

-- account.updated backstop: enable payouts by account id
select sync_stripe_account_status('acct_test_9', true);
select ok((select stripe_payouts_enabled from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'payouts_enabled synced from webhook');

-- transfer.reversed: refund + mark rejected (balance 0 → 100), idempotent on re-fire
select revert_affiliate_payout_by_transfer('tr_test_9');
select is((select status from affiliate_payouts where id = 'dddddddd-0000-0000-0000-0000000000d1'), 'rejected', 'reversed payout marked rejected');
select is((select balance from affiliate_commission where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric, 100::numeric, 'balance refunded on reversal');
-- re-fire (webhooks can duplicate): payout no longer 'paid' → no-op, no double refund
select revert_affiliate_payout_by_transfer('tr_test_9');
select is((select balance from affiliate_commission where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::numeric, 100::numeric, 'idempotent: re-fire does NOT double-refund');

reset role;
select * from finish();
rollback;
