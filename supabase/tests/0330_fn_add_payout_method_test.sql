-- Lane D polish: add_payout_method — a worker adds their own payout method (claims-derived).
-- CRITICAL: identity from JWT (own staff_id only); first method auto-default; making default clears others.
begin;
select plan(8);

select has_function('add_payout_method', 'add_payout_method() exists');
select ok(not has_function_privilege('anon', 'add_payout_method(text,text,boolean)', 'execute'), 'anon CANNOT execute');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1', '11111111-1111-1111-1111-111111111111', 'cust@a', 'Cst', 'customer');

set local role authenticated;

-- customer (not a worker) refused
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0c1"}';
select throws_ok($$ select add_payout_method('paypal', 'x@y.z', true) $$, 'NOT_WORKER', 'customer cannot add a payout method');

-- staff adds first method → becomes default automatically
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select add_payout_method('paypal', 'me@paypal.me', false);
select is((select count(*) from staff_payout_methods where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1' and is_default)::int, 1, 'first method auto-becomes default');

-- bad kind / empty detail rejected
select throws_ok($$ select add_payout_method('gold', 'x', false) $$, 'INVALID_KIND', 'invalid kind rejected');
select throws_ok($$ select add_payout_method('bank', '   ', false) $$, 'INVALID_DETAIL', 'empty detail rejected');

-- adding a 2nd method as default flips the default to the new one (exactly one default)
select add_payout_method('bank', 'IBAN123', true);
select is((select count(*) from staff_payout_methods where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1')::int, 2, 'two methods now');
select is((select detail from staff_payout_methods where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1' and is_default), 'IBAN123', 'new default is the bank method (exactly one default)');

reset role;
select * from finish();
rollback;
