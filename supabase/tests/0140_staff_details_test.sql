-- staff_details RLS: admin sees the whole tenant; a staff member sees only their own row.
begin;
select plan(6);

select has_table('staff_details', 'staff_details table exists');
select ok((select relrowsecurity from pg_class where relname = 'staff_details'), 'RLS on staff_details');

-- seed as superuser: tenant A with two staff profiles + their staff_details
insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 's1@a.com', 'S1', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 's2@a.com', 'S2', 'staff'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 's3@a.com', 'S3', 'staff');
insert into staff_details(id, tenant_id, profile_id, skills, capacity) values
  ('11110000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{seo,content}', 5),
  ('11110000-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{backlinks}', 3);

set local role authenticated;

-- admin sees both staff_details rows in their tenant
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from staff_details)::int, 2, 'admin sees both staff_details rows');

-- staff S1 sees only their own row
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from staff_details)::int, 1, 'staff S1 sees only their own row');

-- staff S3 has no staff_details row of their own — sees nothing
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"cccccccc-cccc-cccc-cccc-cccccccccccc"}';
select is((select count(*) from staff_details)::int, 0, 'staff with no detail sees 0 rows');

-- cross-tenant admin sees nothing
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from staff_details)::int, 0, 'cross-tenant admin sees 0 rows');

reset role;
select * from finish();
rollback;
