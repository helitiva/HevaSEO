-- E0d increment 3: post earnings to staff/affiliate wallets + manager-override cascade.
-- A staffer earning commission+gig also triggers their pod manager's % override. Each wallet's
-- authoritative balance must equal SUM of its ledger.
begin;
select plan(7);

select has_function('post_staff_pay', 'post_staff_pay() exists');
select has_function('post_affiliate_commission', 'post_affiliate_commission() exists');

-- seed: a staff in a manager's pod, an affiliate, and an order
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into customers(id, tenant_id, name, status) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'C1', 'claimed');
insert into profiles(id, tenant_id, email, name, role) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 's1@a.com',  'S1',  'staff'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', 'mgr@a.com', 'Mgr', 'manager'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'af@a.com',  'AF',  'affiliate');
insert into staff_details(tenant_id, profile_id, manager_id) values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1');
insert into affiliates(id, tenant_id, user_id, code, status) values
  ('af100000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AF1', 'active');
insert into orders(id, tenant_id, code, customer_id, service, value) values
  ('0d000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'O1', '00000000-0000-0000-0000-000000000001', 'Keyword', 500);

-- post staff pay: commission 200 + gig 100 → staff wallet 300
select post_staff_pay('0d000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 200, 100, null);
select is(
  (select balance from staff_wallet where staff_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1')::numeric,
  300::numeric, 'staff wallet credited with commission + gig');
-- manager override = gig 100 * 10% + commission 200 * 15% = 10 + 30 = 40
select is(
  (select balance from staff_wallet where staff_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1')::numeric,
  40::numeric, 'pod manager earns the override (10% gig + 15% commission)');
-- invariant for the staff wallet
select is(
  (select balance from staff_wallet where staff_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1')::numeric,
  (select coalesce(sum(amount), 0) from wallet_ledger where staff_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1')::numeric,
  'CRITICAL: staff_wallet balance == SUM(wallet_ledger)');

-- post affiliate commission 150
select post_affiliate_commission('0d000000-0000-0000-0000-0000000000a1', 'af100000-0000-0000-0000-000000000001', 150, null);
select is(
  (select balance from affiliate_commission where affiliate_id = 'af100000-0000-0000-0000-000000000001')::numeric,
  150::numeric, 'affiliate commission wallet credited');
select is(
  (select balance from affiliate_commission where affiliate_id = 'af100000-0000-0000-0000-000000000001')::numeric,
  (select coalesce(sum(amount), 0) from commission_ledger where affiliate_id = 'af100000-0000-0000-0000-000000000001')::numeric,
  'CRITICAL: affiliate_commission balance == SUM(commission_ledger)');

select * from finish();
rollback;
