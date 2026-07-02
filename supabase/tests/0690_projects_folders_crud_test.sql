-- Projects & Folders CRUD RLS: a customer manages their own; cannot write to or read another customer's.
begin;
select plan(6);

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'c1@a', 'C1', 'customer'),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 'c2@a', 'C2', 'customer');
insert into customers(id, tenant_id, name, company, email, status, user_id) values
  ('cccccccc-0000-0000-0000-00000000c001', '11111111-1111-1111-1111-111111111111', 'One', 'One', 'c1@a', 'claimed', 'aaaaaaaa-0000-0000-0000-0000000000c1'),
  ('cccccccc-0000-0000-0000-00000000c002', '11111111-1111-1111-1111-111111111111', 'Two', 'Two', 'c2@a', 'claimed', 'aaaaaaaa-0000-0000-0000-0000000000c2');
-- C2 owns a folder (seeded as superuser) — used to prove isolation.
insert into folders(id, tenant_id, customer_id, name) values
  ('ffffffff-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-00000000c002', 'C2 folder');

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-0000000000c1"}';

-- C1 creates their own folder + project
insert into folders(tenant_id, customer_id, name, color) values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-00000000c001', 'C1 folder', '#2563eb');
select is((select count(*)::int from folders where customer_id = 'cccccccc-0000-0000-0000-00000000c001'), 1, 'customer creates own folder');
insert into projects(tenant_id, customer_id, name, domain) values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-00000000c001', 'My site', 'acme.com');
select is((select count(*)::int from projects where customer_id = 'cccccccc-0000-0000-0000-00000000c001'), 1, 'customer creates own project');

-- C1 CANNOT create a folder for C2 (with check)
select throws_ok(
  $$ insert into folders(tenant_id, customer_id, name) values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-00000000c002', 'hack') $$,
  '42501', NULL, 'customer cannot create a folder for another customer');

-- C1 cannot see C2's folder
select is((select count(*)::int from folders where customer_id = 'cccccccc-0000-0000-0000-00000000c002'), 0, 'customer cannot read another customer''s folders');

-- C2 cannot delete C1's project (RLS filters the row out → 0 rows affected, project survives)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-0000000000c2"}';
delete from projects where customer_id = 'cccccccc-0000-0000-0000-00000000c001';
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-0000-0000-0000-0000000000c1"}';
select is((select count(*)::int from projects where customer_id = 'cccccccc-0000-0000-0000-00000000c001'), 1, 'another customer cannot delete your project');

-- C1 deletes their own folder
delete from folders where customer_id = 'cccccccc-0000-0000-0000-00000000c001';
select is((select count(*)::int from folders where customer_id = 'cccccccc-0000-0000-0000-00000000c001'), 0, 'customer deletes own folder');

reset role;
select * from finish();
rollback;
