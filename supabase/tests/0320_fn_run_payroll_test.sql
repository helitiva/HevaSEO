-- Lane D inc-D7: run_payroll — admin posts a worker's fixed pay (salary+gig+bonus) for a period.
-- CRITICAL: idempotent per (worker, period) — never pays twice; admin-only; total = sum.
begin;
select plan(8);

select has_function('run_payroll', 'run_payroll() exists');
select ok(not has_function_privilege('anon', 'run_payroll(uuid,text,numeric,numeric,numeric)', 'execute'), 'anon CANNOT execute run_payroll');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '11111111-1111-1111-1111-111111111111', 'staff@a', 'Stf', 'staff');

set local role authenticated;

-- non-admin refused
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2"}';
select throws_ok($$ select run_payroll('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '2026-06', 1300, 11, 0) $$, 'NOT_ADMIN', 'non-admin cannot run payroll');

-- admin runs payroll for 2026-06 → one record, total = 1311
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
select run_payroll('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '2026-06', 1300, 11, 0);
select is((select count(*) from payroll_runs where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::int, 1, 'one payroll run recorded');
select is((select total from payroll_runs where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2' and period = '2026-06')::numeric, 1311::numeric, 'total = salary+gig+bonus');

-- CRITICAL: re-running the SAME period is idempotent — no second record
select run_payroll('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '2026-06', 9999, 9999, 9999);
select is((select count(*) from payroll_runs where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::int, 1, 'CRITICAL: re-run same period makes no second record (no double-pay)');
select is((select total from payroll_runs where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2' and period = '2026-06')::numeric, 1311::numeric, 'idempotent: original total unchanged on re-run');

-- a different period creates a new record
select run_payroll('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2', '2026-07', 1300, 20, 50);
select is((select count(*) from payroll_runs where staff_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a2')::int, 2, 'a new period creates a new run');

reset role;
select * from finish();
rollback;
