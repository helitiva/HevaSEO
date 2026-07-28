-- Lane D inc-D5: penalties — admin applies (debits wallet), worker disputes, admin waives (refunds).
-- CRITICAL: apply debits + waive refunds; balance==SUM(ledger); admin/worker gating.
begin;
select plan(10);

select has_function('apply_penalty', 'apply_penalty() exists');
select has_function('dispute_penalty', 'dispute_penalty() exists');
select has_function('waive_penalty', 'waive_penalty() exists');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff');
insert into staff_wallet(staff_id, tenant_id, balance) values ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 100);
insert into wallet_ledger(tenant_id, staff_id, amount, kind, note) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', 100, 'commission', 'seed');

set local role authenticated;

-- a non-admin cannot apply a penalty
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2"}';
select throws_ok($$ select apply_penalty('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', 30, 'late', 'late delivery') $$, 'NOT_ADMIN', 'staff cannot apply a penalty');

-- admin applies a $30 penalty → wallet 100 → 70, an 'applied' penalty
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select apply_penalty('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', 30, 'late', 'late delivery');
select is((select balance from staff_wallet where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::numeric, 70::numeric, 'apply debits wallet 100 → 70');
select is((select count(*) from staff_penalties where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2' and status = 'applied')::int, 1, 'an applied penalty exists');

-- the worker disputes it
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2"}';
select dispute_penalty((select id from staff_penalties where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2'), 'It was on time');
select is((select status from staff_penalties where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2'), 'disputed', 'worker dispute → disputed');

-- admin waives it → refund 30 → wallet 70 → 100
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select waive_penalty((select id from staff_penalties where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2'));
select is((select status from staff_penalties where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2'), 'waived', 'waive → waived');
select is((select balance from staff_wallet where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::numeric, 100::numeric, 'waive REFUNDS 30 → balance back to 100');
select is(
  (select balance from staff_wallet where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::numeric,
  (select coalesce(sum(amount),0) from wallet_ledger where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::numeric,
  'CRITICAL: balance == SUM(wallet_ledger) after apply + waive');

reset role;
select * from finish();
rollback;
