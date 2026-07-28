-- The DELETE halves of the customer settings CRUD (20260702210000_settings_backend). 0730 covers create:
-- create_api_key, upsert_webhook. It never covered taking them away — revoke_api_key and delete_webhook —
-- yet those are the security-relevant halves: revoking a leaked key, removing a webhook that leaks data.
-- Both must be customer-only and strictly own-scoped (a customer cannot revoke or delete another's).
begin;
select plan(10);

select has_function('revoke_api_key', 'revoke_api_key() exists');
select has_function('delete_webhook', 'delete_webhook() exists');
select ok(not has_function_privilege('anon', 'revoke_api_key(uuid)', 'execute'), 'anon cannot revoke a key');
select ok(not has_function_privilege('anon', 'delete_webhook(uuid)', 'execute'), 'anon cannot delete a webhook');

insert into tenants(id, name) values ('55555555-5555-5555-5555-555555555555', 'Settings');
insert into profiles(id, tenant_id, email, name, role) values
  ('55550000-0000-4000-8000-0000000000c1', '55555555-5555-5555-5555-555555555555', 'c1@s', 'C1', 'customer'),
  ('55550000-0000-4000-8000-0000000000c2', '55555555-5555-5555-5555-555555555555', 'c2@s', 'C2', 'customer'),
  ('55550000-0000-4000-8000-0000000000f1', '55555555-5555-5555-5555-555555555555', 's1@s', 'S1', 'staff');
insert into customers(id, tenant_id, name, email, status, tier, user_id) values
  ('55550000-0000-4000-8000-0000000000d1', '55555555-5555-5555-5555-555555555555', 'One', 'c1@s', 'claimed', 'new', '55550000-0000-4000-8000-0000000000c1'),
  ('55550000-0000-4000-8000-0000000000d2', '55555555-5555-5555-5555-555555555555', 'Two', 'c2@s', 'claimed', 'new', '55550000-0000-4000-8000-0000000000c2');

set local role authenticated;

-- ── customer 1 creates a key + a webhook, and we grab their ids (own-row reads are allowed) ───────────
set local request.jwt.claims = '{"tenant_id":"55555555-5555-5555-5555-555555555555","app_role":"customer","profile_id":"55550000-0000-4000-8000-0000000000c1"}';
select create_api_key('K1');
select upsert_webhook('https://c1.example', '{order.created}'::text[]);
select set_config('test.kid', (select id::text from api_keys where customer_id = current_customer_id() limit 1), true);
select set_config('test.wid', (select id::text from webhooks  where customer_id = current_customer_id() limit 1), true);

-- ── customer 2 cannot touch customer 1's rows (own-scoped WHERE → silent no-op, key/webhook survive) ──
set local request.jwt.claims = '{"tenant_id":"55555555-5555-5555-5555-555555555555","app_role":"customer","profile_id":"55550000-0000-4000-8000-0000000000c2"}';
select revoke_api_key(current_setting('test.kid')::uuid);   -- wrong owner: no error, no effect
select delete_webhook(current_setting('test.wid')::uuid);   -- wrong owner: no error, no effect

set local request.jwt.claims = '{"tenant_id":"55555555-5555-5555-5555-555555555555","app_role":"customer","profile_id":"55550000-0000-4000-8000-0000000000c1"}';
select ok((select revoked_at is null from api_keys where id = current_setting('test.kid')::uuid),
          'CRITICAL: another customer''s revoke did NOT touch this key — it is still active');
select is((select count(*) from webhooks where id = current_setting('test.wid')::uuid)::int, 1,
          'CRITICAL: another customer''s delete did NOT remove this webhook');

-- ── a non-customer is locked out entirely ────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"tenant_id":"55555555-5555-5555-5555-555555555555","app_role":"staff","profile_id":"55550000-0000-4000-8000-0000000000f1"}';
select throws_ok($$ select revoke_api_key(current_setting('test.kid')::uuid) $$, 'NOT_CUSTOMER', 'a staffer cannot revoke a key');
select throws_ok($$ select delete_webhook(current_setting('test.wid')::uuid) $$, 'NOT_CUSTOMER', 'a staffer cannot delete a webhook');

-- ── the owner can, and it takes effect ───────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"tenant_id":"55555555-5555-5555-5555-555555555555","app_role":"customer","profile_id":"55550000-0000-4000-8000-0000000000c1"}';
select revoke_api_key(current_setting('test.kid')::uuid);
select isnt((select revoked_at from api_keys where id = current_setting('test.kid')::uuid), null,
            'the owner revoking the key stamps revoked_at');
select delete_webhook(current_setting('test.wid')::uuid);
select is((select count(*) from webhooks where id = current_setting('test.wid')::uuid)::int, 0,
          'the owner deleting the webhook removes it');

select * from finish();
rollback;
