-- Lane D inc-D7: payroll runs. MONEY (gác③). A payroll run RECORDS a worker's FIXED pay for a period
-- (salary + gig + bonus) as paid — the variable commission lives in the wallet and is withdrawn there
-- (request_payout), so payroll does NOT touch the wallet and there's no double-count. Idempotent per
-- (worker, period): re-running returns the same record (never pays twice). Admin-gated.
create table payroll_runs (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references profiles(id) on delete cascade,
  period     text not null,                       -- e.g. '2026-06'
  salary     numeric(12,2) not null default 0,
  gig        numeric(12,2) not null default 0,
  bonus      numeric(12,2) not null default 0,
  total      numeric(12,2) not null,
  status     text not null default 'paid' check (status in ('paid')),
  created_at timestamptz not null default now(),
  unique (tenant_id, staff_id, period)
);
create index payroll_runs_tenant_idx on payroll_runs (tenant_id);
create index payroll_runs_staff_idx  on payroll_runs (staff_id);

alter table payroll_runs enable row level security;
grant select on payroll_runs to authenticated;
create policy payroll_runs_admin on payroll_runs for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy payroll_runs_own on payroll_runs for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() in ('staff', 'manager') and staff_id = current_profile_id());

-- run_payroll (admin): post a worker's fixed pay for a period. Idempotent per (worker, period).
create or replace function run_payroll(p_staff uuid, p_period text, p_salary numeric, p_gig numeric, p_bonus numeric)
returns payroll_runs
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor  uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_run    payroll_runs;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if coalesce(p_salary,0) < 0 or coalesce(p_gig,0) < 0 or coalesce(p_bonus,0) < 0 then raise exception 'INVALID_AMOUNT'; end if;

  -- idempotent: a run for this worker+period already exists → return it (never pay twice)
  select * into v_run from payroll_runs where tenant_id = v_tenant and staff_id = p_staff and period = p_period;
  if found then return v_run; end if;

  insert into payroll_runs(tenant_id, staff_id, period, salary, gig, bonus, total)
       values (v_tenant, p_staff, p_period, coalesce(p_salary,0), coalesce(p_gig,0), coalesce(p_bonus,0),
               coalesce(p_salary,0) + coalesce(p_gig,0) + coalesce(p_bonus,0))
    returning * into v_run;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'payroll.run', 'staff', p_staff);
  return v_run;
end $$;

revoke execute on function run_payroll(uuid, text, numeric, numeric, numeric) from public;
grant  execute on function run_payroll(uuid, text, numeric, numeric, numeric) to authenticated;
