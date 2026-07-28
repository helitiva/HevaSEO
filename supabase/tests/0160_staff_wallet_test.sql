-- E0b money increment 2: staff wallet RLS — CRITICAL money-blind tests.
-- Managers and customers must see 0 staff money; staff see ONLY their own.
begin;
select plan(13);

select has_table('staff_wallet', 'staff_wallet table exists');
select has_table('wallet_ledger', 'wallet_ledger table exists');
select has_table('staff_payout_methods', 'staff_payout_methods table exists');
select has_table('payout_requests', 'payout_requests table exists');
select ok((select relrowsecurity from pg_class where relname = 'staff_wallet'), 'RLS on staff_wallet');
select ok((select relrowsecurity from pg_class where relname = 'payout_requests'), 'RLS on payout_requests');

-- seed as superuser
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 's1@a.com', 'S1', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 's2@a.com', 'S2', 'staff');
insert into staff_wallet(staff_id, tenant_id, balance) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 320.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 80.00);
insert into wallet_ledger(tenant_id, staff_id, amount, kind) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 200.00, 'commission'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -20.00, 'penalty');
insert into staff_payout_methods(id, tenant_id, staff_id, kind, detail, is_default) values
  ('99990000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bank', 'ACB ****1234', true);
insert into payout_requests(tenant_id, staff_id, amount, method_id) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 100.00, '99990000-0000-0000-0000-0000000000a1'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 50.00, null);

set local role authenticated;

-- admin sees all tenant wallets
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from staff_wallet)::int, 2, 'admin sees all tenant wallets');

-- staff S1 sees only their own wallet + ledger + payout request
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from staff_wallet)::int, 1, 'staff sees only their own wallet');
select is((select count(*) from wallet_ledger)::int, 2, 'staff sees only their own ledger');
select is((select count(*) from payout_requests)::int, 1, 'staff sees only their own payout requests');

-- CRITICAL: manager sees no staff money (money-blind)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager"}';
select is((select count(*) from staff_wallet)::int, 0, 'CRITICAL: manager sees 0 staff wallets (money-blind)');

-- CRITICAL: customer sees no staff money
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from staff_wallet)::int, 0, 'CRITICAL: customer sees 0 staff wallets');

-- cross-tenant admin sees nothing of tenant A
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from staff_wallet)::int, 0, 'cross-tenant admin sees 0 wallets');

reset role;
select * from finish();
rollback;
