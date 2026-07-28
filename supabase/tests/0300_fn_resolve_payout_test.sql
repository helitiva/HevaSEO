-- Lane D inc-D4: resolve_payout — admin approves/pays/rejects a staff payout request. CRITICAL:
-- reject REFUNDS the held amount to the wallet (balance==SUM(ledger)); admin-only; no double-resolve.
begin;
select plan(10);

select has_function('resolve_payout', 'resolve_payout() exists');
select ok(not has_function_privilege('anon', 'resolve_payout(uuid,text)', 'execute'), 'anon CANNOT execute resolve_payout');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff');
-- staffer already requested a payout: wallet debited 100 → 60, a 'requested' row + a -40 ledger entry
insert into staff_wallet(staff_id, tenant_id, balance) values ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 60);
insert into wallet_ledger(tenant_id, staff_id, amount, kind, note) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', 100, 'commission', 'seed'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', -40, 'payout', 'payout request');
insert into payout_requests(id, tenant_id, staff_id, amount, status) values
  ('99999999-9999-9999-9999-00000000e0e1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', 40, 'requested'),
  ('99999999-9999-9999-9999-00000000e0e2', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', 40, 'requested');

set local role authenticated;

-- a non-admin (the staffer) cannot resolve
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2"}';
select throws_ok($$ select resolve_payout('99999999-9999-9999-9999-00000000e0e1', 'approve') $$, 'NOT_ADMIN', 'staff cannot resolve a payout');

-- admin approves req #1 → 'approved', wallet unchanged (60)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select resolve_payout('99999999-9999-9999-9999-00000000e0e1', 'approve');
select is((select status from payout_requests where id = '99999999-9999-9999-9999-00000000e0e1'), 'approved', 'approve → approved');
select is((select balance from staff_wallet where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::numeric, 60::numeric, 'approve leaves balance unchanged');

-- admin rejects req #2 → 'rejected' + refund 40 → wallet 60 → 100
select resolve_payout('99999999-9999-9999-9999-00000000e0e2', 'reject');
select is((select status from payout_requests where id = '99999999-9999-9999-9999-00000000e0e2'), 'rejected', 'reject → rejected');
select is((select balance from staff_wallet where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::numeric, 100::numeric, 'reject REFUNDS 40 → balance back to 100');
select is(
  (select balance from staff_wallet where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::numeric,
  (select coalesce(sum(amount),0) from wallet_ledger where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::numeric,
  'CRITICAL: balance == SUM(wallet_ledger) after refund');

-- can't re-resolve an already-approved → pay works once, then re-pay fails
select resolve_payout('99999999-9999-9999-9999-00000000e0e1', 'pay');
select is((select status from payout_requests where id = '99999999-9999-9999-9999-00000000e0e1'), 'paid', 'approved → pay → paid');
select throws_ok($$ select resolve_payout('99999999-9999-9999-9999-00000000e0e1', 'pay') $$, 'ALREADY_RESOLVED', 'cannot re-resolve a paid request');

reset role;
select * from finish();
rollback;
