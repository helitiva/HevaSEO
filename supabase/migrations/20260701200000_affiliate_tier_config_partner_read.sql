-- Lane E inc-E10: let partners see the program's tier ladder. Tier thresholds/rates are the earning
-- TERMS an affiliate is entitled to see (unlike affiliate_program_config, which stays admin-only). Add a
-- tenant-scoped read for any authenticated user so the partner dashboard renders config-driven tiers.
-- (affiliate_program_config keeps its admin-only read — min_payout etc. are not partner-facing here.)
create policy affiliate_tier_config_tenant_read on affiliate_tier_config
  for select using (tenant_id = current_tenant_id());
