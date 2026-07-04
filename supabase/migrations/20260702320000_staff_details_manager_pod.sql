-- A manager could not see their pod's staff operational profiles: staff_details had admin + staff-own
-- policies but NO manager policy, so getStaff() (which drops any staff whose staff_details is null)
-- returned an EMPTY roster for managers → the Assignment queue's "Pick" dropdown + Staff workload were
-- empty and utilization showed NaN. staff_details is NON-money (skills/capacity/role/perf), so a manager
-- may read the profiles of their own pod (staff_details.manager_id = them). Money tables (staff_wallet,
-- payouts) keep NO manager policy and stay blind.
create policy staff_details_manager_pod on staff_details
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'manager'
    and manager_id = current_profile_id()
  );
