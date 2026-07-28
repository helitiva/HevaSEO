-- payroll_runs could not record the number the Finance page says we owe.
--
-- staff_comp (the admin-set config) accrues `base_salary + commission_pct × delivered order value`, and
-- Finance reports that as "Payouts due". But payroll_runs — the record of what was actually PAID — has
-- only salary/gig/bonus. There is no commission column, so running payroll can never settle the
-- commission half of the debt. Consequence: "Payouts due $3,044.40" never decreases. Pay everyone,
-- reload, still $3,044.40 — and nothing in the schema can tell you it's already been paid.
--
-- Decision (2026-07-17): staff_comp is the source of truth for what is OWED; payroll_runs records what
-- has been PAID; outstanding = accrued − paid. staff_wallet stays a separate concern (withdrawable
-- balance / bonuses), not a second definition of commission.
alter table payroll_runs add column commission numeric(12,2) not null default 0;

-- Recreate run_payroll with the commission leg. Signature changes, so drop the old one explicitly —
-- otherwise both overloads survive and PostgREST picks by argument shape, which would silently keep
-- writing commission-less rows from any caller that omits the new arg.
drop function if exists run_payroll(uuid, text, numeric, numeric, numeric);

create or replace function run_payroll(p_staff uuid, p_period text, p_salary numeric, p_gig numeric, p_bonus numeric, p_commission numeric default 0)
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
  if coalesce(p_salary,0) < 0 or coalesce(p_gig,0) < 0 or coalesce(p_bonus,0) < 0 or coalesce(p_commission,0) < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- idempotent: a run for this worker+period already exists → return it (never pay twice)
  select * into v_run from payroll_runs where tenant_id = v_tenant and staff_id = p_staff and period = p_period;
  if found then return v_run; end if;

  insert into payroll_runs(tenant_id, staff_id, period, salary, gig, bonus, commission, total)
       values (v_tenant, p_staff, p_period, coalesce(p_salary,0), coalesce(p_gig,0), coalesce(p_bonus,0),
               coalesce(p_commission,0),
               coalesce(p_salary,0) + coalesce(p_gig,0) + coalesce(p_bonus,0) + coalesce(p_commission,0))
    returning * into v_run;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_tenant, v_actor, 'payroll.run', 'staff', p_staff,
               jsonb_build_object('period', p_period, 'total', v_run.total, 'commission', v_run.commission));
  return v_run;
end $$;

revoke execute on function run_payroll(uuid, text, numeric, numeric, numeric, numeric) from public;
grant  execute on function run_payroll(uuid, text, numeric, numeric, numeric, numeric) to authenticated;
