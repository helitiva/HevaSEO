-- Correction (per product review): managers ALSO have their own wallet — salary + pod-override
-- commission + payouts — and can withdraw. They see ONLY their own, exactly like staff. They stay
-- money-blind to OTHER workers' wallets and to all customer/affiliate money (those policies are
-- unchanged). This is additive: it mirrors the staff-own policies for the manager role.
-- (staff_id holds any internal worker's profile id — staff OR manager.)

create policy staff_wallet_mgr_own on staff_wallet
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'manager' and staff_id = current_profile_id());

create policy wallet_ledger_mgr_own on wallet_ledger
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'manager' and staff_id = current_profile_id());

create policy staff_payout_methods_mgr_own on staff_payout_methods
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'manager' and staff_id = current_profile_id());

create policy payout_requests_mgr_own on payout_requests
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'manager' and staff_id = current_profile_id());
