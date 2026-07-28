-- Manager owns a wallet too: sees ONLY their own, never another worker's. Money-blind to others holds.
begin;
select plan(4);

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', 'mgr@a.com', 'Mgr', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 's1@a.com',  'S1',  'staff');
insert into staff_wallet(staff_id, tenant_id, balance) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', 900.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 320.00);
insert into wallet_ledger(tenant_id, staff_id, amount, kind) values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 400.00, 'commission');

set local role authenticated;

-- the manager sees ONLY their own wallet (not the staff member's)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"cccccccc-cccc-cccc-cccc-ccccccccccc1"}';
select is((select count(*) from staff_wallet)::int, 1, 'manager sees only their own wallet (not other workers)');
select is((select count(*) from wallet_ledger)::int, 1, 'manager sees only their own wallet ledger');

-- admin sees both worker wallets
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from staff_wallet)::int, 2, 'admin sees all worker wallets');

-- staff still sees only their own
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"}';
select is((select count(*) from staff_wallet)::int, 1, 'staff still sees only their own wallet');

reset role;
select * from finish();
rollback;
