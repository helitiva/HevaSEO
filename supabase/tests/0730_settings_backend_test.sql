-- Settings backend: customer-only prefs (2FA, auto top-up), hashed API keys, single-webhook upsert,
-- payment-method metadata with default promotion — all customer-scoped + RLS-isolated between customers.
begin;
select plan(22);

select has_function('set_my_settings',      'set_my_settings() exists');
select has_function('create_api_key',       'create_api_key() exists');
select has_function('upsert_webhook',       'upsert_webhook() exists');
select has_function('add_payment_method',   'add_payment_method() exists');
select ok(not has_function_privilege('anon', 'create_api_key(text)', 'execute'), 'anon CANNOT create an API key');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-000000000c11', '11111111-1111-1111-1111-111111111111', 'c1@a', 'C1', 'customer'),
  ('aaaaaaaa-0000-0000-0000-000000000c22', '11111111-1111-1111-1111-111111111111', 'c2@a', 'C2', 'customer'),
  ('aaaaaaaa-0000-0000-0000-000000000f11', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff');
insert into customers(id, tenant_id, name, email, status, tier, user_id) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'One', 'c1@a', 'claimed', 'new', 'aaaaaaaa-0000-0000-0000-000000000c11'),
  ('cccccccc-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 'Two', 'c2@a', 'claimed', 'new', 'aaaaaaaa-0000-0000-0000-000000000c22');

-- ── customer 1 mutates every surface ─────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';

select set_my_settings(p_two_factor => true, p_auto_topup => '{"enabled":true,"threshold":50,"amount":250}'::jsonb);
select set_config('test.tok', (select token from create_api_key('K1')), true);
select upsert_webhook('https://a.example', '{order.created}'::text[]);
select upsert_webhook('https://b.example', '{}'::text[]);
select add_payment_method('Visa', '4242', 8, 2027);
select add_payment_method('MC',   '1111', 1, 2030);

select matches(current_setting('test.tok'), '^sk_live_[0-9a-f]{48}$', 'create_api_key returns a live plaintext token');
select throws_ok($$ select add_payment_method('Visa', '12') $$, 'BAD_LAST4', 'rejects a non-4-digit last4');

-- ── a non-customer is locked out ─────────────────────────────────────────────────
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-0000-0000-0000-000000000f11"}';
select throws_ok($$ select create_api_key('x') $$,               'NOT_CUSTOMER', 'non-customer cannot create an API key');
select throws_ok($$ select set_my_settings(p_two_factor => true) $$, 'NOT_CUSTOMER', 'non-customer cannot change settings');

-- ── customer 2 cannot see customer 1's rows (RLS) ────────────────────────────────
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c22"}';
select is((select count(*) from api_keys)::int,        0, 'customer B cannot see customer A''s API keys');
select is((select count(*) from webhooks)::int,        0, 'customer B cannot see customer A''s webhooks');
select is((select count(*) from payment_methods)::int, 0, 'customer B cannot see customer A''s payment methods');

-- customer 1 flips the default payment method
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';
select set_default_payment_method((select id from payment_methods where brand = 'MC'));

-- ── verify as superuser (RLS would otherwise hide the rows) ───────────────────────
reset role;
select is((select two_factor_enabled from customers where id = 'cccccccc-0000-0000-0000-0000000000c1'), true, '2FA preference persisted');
select is((select auto_topup->>'threshold' from customers where id = 'cccccccc-0000-0000-0000-0000000000c1'), '50', 'auto top-up persisted');
select is((select last4 from api_keys where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), right(current_setting('test.tok'), 4), 'stored last4 matches the token tail');
select is((select token_hash from api_keys where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), encode(extensions.digest(current_setting('test.tok'), 'sha256'), 'hex'), 'only the sha256 hash of the token is stored');
select is((select count(*) from webhooks where customer_id = 'cccccccc-0000-0000-0000-0000000000c1')::int, 1, 'one webhook per customer after two upserts');
select is((select url from webhooks where customer_id = 'cccccccc-0000-0000-0000-0000000000c1'), 'https://b.example', 'upsert updates the existing webhook');
select is((select count(*) from payment_methods where customer_id = 'cccccccc-0000-0000-0000-0000000000c1')::int, 2, 'both payment methods stored');
select is((select brand from payment_methods where customer_id = 'cccccccc-0000-0000-0000-0000000000c1' and is_default), 'MC', 'set_default flips the default method');

-- customer 1 removes the default → the remaining method is promoted
set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';
select remove_payment_method((select id from payment_methods where brand = 'MC'));
reset role;
select is((select brand from payment_methods where customer_id = 'cccccccc-0000-0000-0000-0000000000c1' and is_default), 'Visa', 'removing the default promotes the remaining method');
select is((select count(*) from payment_methods where customer_id = 'cccccccc-0000-0000-0000-0000000000c1')::int, 1, 'method removed');

select * from finish();
rollback;
