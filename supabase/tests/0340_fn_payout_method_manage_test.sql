-- Lane D polish: set_default_payout_method + remove_payout_method (claims-derived, own rows only).
begin;
select plan(8);

select has_function('set_default_payout_method', 'set_default_payout_method() exists');
select has_function('remove_payout_method', 'remove_payout_method() exists');
select ok(not has_function_privilege('anon', 'remove_payout_method(uuid)', 'execute'), 'anon CANNOT remove');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 's2@a', 'S2', 'staff');
insert into staff_payout_methods(id, tenant_id, staff_id, kind, detail, is_default) values
  ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', 'paypal', 'a@p', true),
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', 'bank', 'IBAN', false),
  ('dddddddd-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', 'wise', 'w@x', true);

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';

-- set-default flips to the bank method (exactly one default)
select set_default_payout_method('dddddddd-0000-0000-0000-000000000002');
select is((select detail from staff_payout_methods where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1' and is_default), 'IBAN', 'set-default flips to the chosen method');
select is((select count(*) from staff_payout_methods where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1' and is_default)::int, 1, 'exactly one default');

-- CRITICAL: cannot touch another worker's method (own rows only)
select throws_ok($$ select set_default_payout_method('dddddddd-0000-0000-0000-000000000003') $$, 'METHOD_NOT_FOUND', 'cannot set-default someone else''s method');

-- removing the current default promotes the remaining method
select remove_payout_method('dddddddd-0000-0000-0000-000000000002');
select is((select count(*) from staff_payout_methods where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1')::int, 1, 'one method left after remove');
select is((select count(*) from staff_payout_methods where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1' and is_default)::int, 1, 'removing the default promotes the remaining method');

reset role;
select * from finish();
rollback;
