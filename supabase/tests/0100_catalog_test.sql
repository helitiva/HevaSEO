-- Catalog RLS: only admin + customer can read. Managers/staff are pricing-blind
-- (no policy) → 0 rows. Customers see active services only; admin sees all.
begin;
select plan(8);

-- structure
select has_table('catalog_services', 'catalog_services table exists');
select has_table('catalog_packages', 'catalog_packages table exists');
select ok((select relrowsecurity from pg_class where relname='catalog_services'), 'RLS on catalog_services');

-- seed tenants
insert into tenants(id,name) values
  ('11111111-1111-1111-1111-111111111111','A'),
  ('22222222-2222-2222-2222-222222222222','B');

-- seed services in tenant A: one active, one inactive (2 total)
insert into catalog_services(id,tenant_id,key,label,pricing_type,active) values
  ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','seo','SEO','flat',true),
  ('cccccccc-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','content','Content','range',false);

-- seed packages under the active service
insert into catalog_packages(id,tenant_id,service_id,name,price,active) values
  ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','Starter',499.00,true),
  ('dddddddd-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','Pro',999.00,true);

set local role authenticated;

-- admin sees ALL tenant services (active + inactive)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from catalog_services)::int, 2, 'admin sees all services');

-- customer sees only ACTIVE services
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer"}';
select is((select count(*) from catalog_services)::int, 1, 'customer sees only active services');

-- manager sees 0 (no policy — pricing-blind)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager"}';
select is((select count(*) from catalog_services)::int, 0, 'manager sees 0 services');

-- staff sees 0 (no policy — pricing-blind)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff"}';
select is((select count(*) from catalog_services)::int, 0, 'staff sees 0 services');

-- cross-tenant admin sees nothing
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from catalog_services)::int, 0, 'cross-tenant admin sees 0');

reset role;
select * from finish();
rollback;
