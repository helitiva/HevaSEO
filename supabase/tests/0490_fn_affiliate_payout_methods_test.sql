-- Lane E inc-E15: affiliate payout methods — add / set-default / remove (claims-derived, own, one default).
begin;
select plan(9);

select has_table('affiliate_payout_methods', 'affiliate_payout_methods table exists');
select ok(not has_function_privilege('anon', 'add_affiliate_payout_method(text,text,boolean)', 'execute'), 'anon CANNOT add method');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer');
insert into affiliates(id, tenant_id, user_id, code, tier, status) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active');

set local role authenticated;

-- non-affiliate refused
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select throws_ok($$ select add_affiliate_payout_method('paypal','a@b.com',true) $$, 'NOT_AFFILIATE', 'customer cannot add method');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';
select throws_ok($$ select add_affiliate_payout_method('gold','x',true) $$, 'INVALID_KIND', 'bad kind rejected');

-- first method → default; second (non-default) stays non-default
select add_affiliate_payout_method('paypal', 'jane@pay.com', false);
select add_affiliate_payout_method('bank', 'IBAN…123', false);
select is((select count(*) from affiliate_payout_methods where is_default)::int, 1, 'exactly one default (the first)');
select is((select kind from affiliate_payout_methods where is_default), 'paypal', 'first method is the default');

-- switch default to the bank one
select set_default_affiliate_payout_method((select id from affiliate_payout_methods where kind = 'bank'));
select is((select kind from affiliate_payout_methods where is_default), 'bank', 'default switched to bank');

-- remove the default → the other is promoted (never zero defaults)
select remove_affiliate_payout_method((select id from affiliate_payout_methods where kind = 'bank'));
select is((select count(*) from affiliate_payout_methods)::int, 1, 'one method left after remove');
select is((select kind from affiliate_payout_methods where is_default), 'paypal', 'remaining method promoted to default');

reset role;
select * from finish();
rollback;
