-- 20260711120000_staff_comp created the table + RLS policies but never granted SELECT, so every read came
-- back "permission denied" and payroll rendered every salary as "not set". RLS and GRANTs are two separate
-- gates: the policy decides WHICH rows, the grant decides whether the role may look at the table at all.
--
-- SELECT only — the policies scope it to admin (whole tenant) or the person's own line. Writes stay closed;
-- they go through set_staff_comp (admin-gated, validating, audited).
grant select on staff_comp to authenticated;
