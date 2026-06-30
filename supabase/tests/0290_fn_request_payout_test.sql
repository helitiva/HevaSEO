-- Lane D inc-D3: request_payout — a staffer withdraws from their own wallet. Claims-derived, atomic
-- debit, guards (min, sufficiency, role, method ownership). CRITICAL: no over-withdraw; balance==SUM(ledger).
begin;
select plan(10);

select has_function('request_payout', 'request_payout() exists');
-- claims-derived + own-wallet only → granted to authenticated (the staffer calls it directly)
select ok(has_function_privilege('authenticated', 'request_payout(numeric,uuid)', 'execute'),
  'authenticated CAN execute request_payout (claims-derived, own wallet)');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'staff@a',  'Stf', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 'cust@a',   'Cus', 'customer');
insert into staff_wallet(staff_id, tenant_id, balance) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 100);
insert into wallet_ledger(tenant_id, staff_id, amount, kind, note) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', 100, 'commission', 'seed');
insert into staff_payout_methods(id, tenant_id, staff_id, kind, detail) values
  ('dddddddd-dddd-dddd-dddd-00000000d0d1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', 'paypal', 'stf@pay');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';

-- request $60 with the staffer's method → wallet 100 → 40, a 'payout' ledger entry, a 'requested' row
select request_payout(60, 'dddddddd-dddd-dddd-dddd-00000000d0d1');
select is((select balance from staff_wallet where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1')::numeric, 40::numeric, 'wallet debited 100 → 40');
select is((select count(*) from payout_requests where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1' and status = 'requested')::int, 1, 'a requested payout row exists');
select is((select amount from wallet_ledger where kind = 'payout' and staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1')::numeric, -60::numeric, 'a −60 payout ledger entry');
select is(
  (select balance from staff_wallet where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1')::numeric,
  (select coalesce(sum(amount),0) from wallet_ledger where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1')::numeric,
  'CRITICAL: balance == SUM(wallet_ledger)');

-- CRITICAL: cannot over-withdraw (balance now 40); nothing changes
select throws_ok($$ select request_payout(9999, null) $$, 'INSUFFICIENT_BALANCE', 'CRITICAL: rejects over-withdraw');
select is((select balance from staff_wallet where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1')::numeric, 40::numeric, 'balance unchanged after rejected over-withdraw');

-- below the minimum
select throws_ok($$ select request_payout(10, null) $$, 'BELOW_MIN', 'rejects below the $50 minimum');

-- a non-staff caller is refused
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2"}';
select throws_ok($$ select request_payout(60, null) $$, 'NOT_STAFF', 'non-staff caller refused');

reset role;
select * from finish();
rollback;
