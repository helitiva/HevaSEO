-- E0b money increment 3: affiliate RLS — CRITICAL money-blind + per-affiliate isolation.
-- manager/staff/customer see 0 affiliate money; each affiliate sees ONLY their own.
begin;
select plan(14);

select has_table('affiliates', 'affiliates table exists');
select has_table('affiliate_commission', 'affiliate_commission table exists');
select has_table('commission_ledger', 'commission_ledger table exists');
select has_table('affiliate_payouts', 'affiliate_payouts table exists');
select ok((select relrowsecurity from pg_class where relname = 'affiliates'), 'RLS on affiliates');
select ok((select relrowsecurity from pg_class where relname = 'affiliate_commission'), 'RLS on affiliate_commission');

-- seed as superuser
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'af1@a.com', 'AF1', 'affiliate'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'af2@a.com', 'AF2', 'affiliate');
insert into affiliates(id, tenant_id, user_id, code, status) values
  ('af100000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AF1CODE', 'active'),
  ('af200000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'AF2CODE', 'active');
insert into affiliate_referrals(tenant_id, affiliate_id, volume) values
  ('11111111-1111-1111-1111-111111111111', 'af100000-0000-0000-0000-000000000001', 1000.00),
  ('11111111-1111-1111-1111-111111111111', 'af100000-0000-0000-0000-000000000001', 500.00);
insert into affiliate_commission(affiliate_id, tenant_id, balance) values
  ('af100000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 150.00),
  ('af200000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 40.00);
insert into commission_ledger(tenant_id, affiliate_id, amount, kind) values
  ('11111111-1111-1111-1111-111111111111', 'af100000-0000-0000-0000-000000000001', 150.00, 'commission');
insert into affiliate_payouts(tenant_id, affiliate_id, amount) values
  ('11111111-1111-1111-1111-111111111111', 'af100000-0000-0000-0000-000000000001', 100.00);

set local role authenticated;

-- admin sees all tenant affiliates
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from affiliates)::int, 2, 'admin sees all tenant affiliates');

-- affiliate AF1 sees only their own record + referrals + commission
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from affiliates)::int, 1, 'affiliate sees only their own record');
select is((select count(*) from affiliate_referrals)::int, 2, 'affiliate sees only their own referrals');
select is((select count(*) from affiliate_commission)::int, 1, 'affiliate sees only their own commission');

-- affiliate AF2 sees only their own commission (per-affiliate isolation)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
select is((select count(*) from affiliate_commission)::int, 1, 'a different affiliate sees only their own commission');

-- CRITICAL: manager sees no affiliate money
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager"}';
select is((select count(*) from affiliate_commission)::int, 0, 'CRITICAL: manager sees 0 affiliate commission (money-blind)');

-- CRITICAL: staff sees no affiliate money
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from affiliate_commission)::int, 0, 'CRITICAL: staff sees 0 affiliate commission');

-- cross-tenant admin sees nothing of tenant A
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from affiliates)::int, 0, 'cross-tenant admin sees 0 affiliates');

reset role;
select * from finish();
rollback;
