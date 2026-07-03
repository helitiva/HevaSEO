-- allowed_transitions is the order state-machine reference matrix (from_state → to_state by_role). It is
-- read ONLY by SECURITY DEFINER order fns (advance_order / cancel_order / manager review / auto-approve),
-- which run as the table owner and bypass RLS. It shipped with RLS OFF and Supabase's default API-role
-- grants, so any anon/authenticated key could REWRITE — or TRUNCATE — the state machine.
-- No client reads it directly, so lock it down completely:
--   • enable RLS (gates SELECT/INSERT/UPDATE/DELETE for the API roles)
--   • revoke ALL direct privileges from anon/authenticated — importantly TRUNCATE, which RLS does NOT gate.
-- The definer fns are unaffected (owner privileges skip RLS and grants).
alter table allowed_transitions enable row level security;
revoke all on allowed_transitions from anon, authenticated;
