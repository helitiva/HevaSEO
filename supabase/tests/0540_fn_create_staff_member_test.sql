-- Lane C/A inc-E23: create_staff_member — admin provisions a shadow staff (profile + details + wallet).
begin;
select plan(9);

select has_function('create_staff_member', 'create_staff_member() exists');
select ok(not has_function_privilege('anon', 'create_staff_member(text,text,text,int,text[])', 'execute'), 'anon CANNOT create staff');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff');

set local role authenticated;

-- non-admin blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a051"}';
select throws_ok($$ select create_staff_member('New','new@x.com','SEO Specialist',5,array['tech']) $$, 'NOT_ADMIN', 'staff cannot create staff');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select throws_ok($$ select create_staff_member('New','bad-email','SEO',5,'{}') $$, 'BAD_EMAIL', 'bad email rejected');

-- happy path: shadow profile + details + wallet
select create_staff_member('New Staff', 'new@x.com', 'SEO Specialist', 7, array['seo','tech']);
select is((select role::text from profiles where email = 'new@x.com' and user_id is null), 'staff', 'shadow staff profile (role staff, user_id null)');
select is((select status::text from profiles where email = 'new@x.com'), 'invited', 'status invited (awaiting claim)');
select is((select capacity from staff_details sd join profiles p on p.id = sd.profile_id where p.email = 'new@x.com'), 7, 'staff_details capacity stored');
select ok((select skills @> array['seo','tech'] from staff_details sd join profiles p on p.id = sd.profile_id where p.email = 'new@x.com'), 'skills stored');
select is((select balance from staff_wallet sw join profiles p on p.id = sw.staff_id where p.email = 'new@x.com')::numeric, 0::numeric, 'wallet initialized at 0');

reset role;
select * from finish();
rollback;
