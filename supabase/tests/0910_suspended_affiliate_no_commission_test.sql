-- A suspended (churned) affiliate earns no commission on new orders (20260727140000). Admin "Suspend"
-- maps to affiliates.status='churned'; post_referral_commission must pay only while the partner is active.
begin;
select plan(5);

insert into tenants(id, name) values ('55555555-5555-5555-5555-555555555555', 'Susp');
insert into profiles(id, tenant_id, email, name, role) values
  ('55550000-0000-4000-8000-0000000000a1', '55555555-5555-5555-5555-555555555555', 'sa@a', 'SA', 'affiliate'),
  ('55550000-0000-4000-8000-0000000000c1', '55555555-5555-5555-5555-555555555555', 'sc@a', 'SC', 'customer');
insert into affiliates(id, tenant_id, user_id, code, tier, status, joined_at) values
  ('55550000-0000-4000-8000-0000000000f1', '55555555-5555-5555-5555-555555555555', '55550000-0000-4000-8000-0000000000a1', 'SUS1', 'bronze', 'active', '2026-01-01');
insert into customers(id, tenant_id, user_id, name, company, email) values
  ('55550000-0000-4000-8000-0000000000d1', '55555555-5555-5555-5555-555555555555', '55550000-0000-4000-8000-0000000000c1', 'SC', 'SCo', 'sc@a');
insert into affiliate_referrals(tenant_id, affiliate_id, customer_id, volume, status) values
  ('55555555-5555-5555-5555-555555555555', '55550000-0000-4000-8000-0000000000f1', '55550000-0000-4000-8000-0000000000d1', 0, 'active');

-- ── while ACTIVE: an approved referred order pays (baseline) ──────────────────────────────────────────
insert into orders(id, tenant_id, customer_id, code, service, state, value) values
  ('55550000-0000-4000-8000-0000000000b1', '55555555-5555-5555-5555-555555555555', '55550000-0000-4000-8000-0000000000d1', 'SU-1', 'Optimization', 'delivered', 300);
update orders set state = 'approved' where id = '55550000-0000-4000-8000-0000000000b1';
select is((select balance from affiliate_commission where affiliate_id = '55550000-0000-4000-8000-0000000000f1')::numeric,
          30::numeric, 'an ACTIVE partner is paid (300 x 10%)');

-- ── SUSPEND the partner, then approve another referred order ─────────────────────────────────────────
update affiliates set status = 'churned' where id = '55550000-0000-4000-8000-0000000000f1';
insert into orders(id, tenant_id, customer_id, code, service, state, value) values
  ('55550000-0000-4000-8000-0000000000b2', '55555555-5555-5555-5555-555555555555', '55550000-0000-4000-8000-0000000000d1', 'SU-2', 'Optimization', 'delivered', 900);
update orders set state = 'approved' where id = '55550000-0000-4000-8000-0000000000b2';
select is((select count(*) from commission_ledger where order_id = '55550000-0000-4000-8000-0000000000b2')::int,
          0, 'CRITICAL: a SUSPENDED partner earns no commission on a new order');
select is((select balance from affiliate_commission where affiliate_id = '55550000-0000-4000-8000-0000000000f1')::numeric,
          30::numeric, 'the wallet is unchanged while suspended (still just the $30 from when active)');
select is((select volume from affiliate_referrals where affiliate_id = '55550000-0000-4000-8000-0000000000f1')::numeric,
          300::numeric, 'and nothing accrues to volume/tier while suspended (still 300, not 1200)');

-- ── REACTIVATE: commission resumes on the next approval ──────────────────────────────────────────────
update affiliates set status = 'active' where id = '55550000-0000-4000-8000-0000000000f1';
insert into orders(id, tenant_id, customer_id, code, service, state, value) values
  ('55550000-0000-4000-8000-0000000000b3', '55555555-5555-5555-5555-555555555555', '55550000-0000-4000-8000-0000000000d1', 'SU-3', 'Optimization', 'delivered', 100);
update orders set state = 'approved' where id = '55550000-0000-4000-8000-0000000000b3';
select is((select balance from affiliate_commission where affiliate_id = '55550000-0000-4000-8000-0000000000f1')::numeric,
          40::numeric, 'reactivating resumes commission ($30 + 100 x 10%)');

select * from finish();
rollback;
