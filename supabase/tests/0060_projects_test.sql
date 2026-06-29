begin;
select plan(6);

-- structure
select has_table('folders', 'folders table exists');
select has_table('projects', 'projects table exists');
select ok((select relrowsecurity from pg_class where relname='projects'), 'RLS on projects');

-- seed tenants, profile, customers
insert into tenants(id,name) values
  ('11111111-1111-1111-1111-111111111111','A'),
  ('22222222-2222-2222-2222-222222222222','B');
insert into profiles(id,tenant_id,email,name,role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','c@a.com','C','customer');
insert into customers(id,tenant_id,user_id,name,status) values
  ('00000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','C1','claimed'),
  ('00000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',null,'C2','shadow');

-- seed projects: 3 owned by C1, 2 for shadow C2 (5 total in tenant A)
insert into projects(id,tenant_id,customer_id,name) values
  ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','P1'),
  ('cccccccc-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','P2'),
  ('cccccccc-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','P3'),
  ('cccccccc-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000002','P4'),
  ('cccccccc-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000002','P5');

set local role authenticated;

-- admin sees all tenant projects
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from projects)::int, 5, 'admin sees all tenant projects');

-- customer sees only own projects
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from projects)::int, 3, 'customer sees only own projects');

-- cross-tenant admin sees nothing
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from projects)::int, 0, 'cross-tenant admin sees 0');

reset role;
select * from finish();
rollback;
