-- Follow-up to 20260702250000 for databases already migrated with its first (partial) version: also revoke
-- TRUNCATE (RLS does not gate it, so it was still exposed) and drop the earlier read policy — redundant
-- because no API role has SELECT on this reference matrix; only the SECURITY DEFINER order fns read it.
revoke all on allowed_transitions from anon, authenticated;
drop policy if exists allowed_transitions_read on allowed_transitions;
