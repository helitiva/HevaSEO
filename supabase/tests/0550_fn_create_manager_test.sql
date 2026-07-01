-- inc-E24: create_manager — admin provisions a shadow manager (wallet) or admin (no wallet).
begin;
select plan(8);

select has_function('create_manager', 'create_manager() exists');
select ok(not has_function_privilege('anon', 'create_manager(text,text,text)', 'execute'), 'anon CANNOT create manager');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff');

set local role authenticated;

-- non-admin blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a051"}';
select throws_ok($$ select create_manager('New','new@x.com','manager') $$, 'NOT_ADMIN', 'staff cannot create manager');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select throws_ok($$ select create_manager('New','mgr@x.com','superuser') $$, 'BAD_ROLE', 'invalid role rejected');

-- manager: shadow profile + wallet
select create_manager('New Manager', 'mgr@x.com', 'manager');
select is((select role::text from profiles where email = 'mgr@x.com' and user_id is null), 'manager', 'shadow manager profile (role manager, user_id null)');
select is((select balance from staff_wallet sw join profiles p on p.id = sw.staff_id where p.email = 'mgr@x.com')::numeric, 0::numeric, 'manager wallet initialized');

-- admin: shadow profile, NO wallet
select create_manager('New Admin', 'adm2@x.com', 'admin');
select is((select role::text from profiles where email = 'adm2@x.com'), 'admin', 'shadow admin profile (role admin)');
select is((select count(*) from staff_wallet sw join profiles p on p.id = sw.staff_id where p.email = 'adm2@x.com')::int, 0, 'admin has NO wallet');

reset role;
select * from finish();
rollback;
