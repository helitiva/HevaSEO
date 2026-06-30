-- Phase 2 / inc-Q2: the public quick-checkout route handler (service role) provisions/links the customer
-- account around materialize_order — it resolves the profile by email and find/create/links the customer
-- row. service_role bypasses RLS but still needs table privileges (these tables only granted authenticated
-- for the RLS read path). Identity tables, server-only role — safe to grant directly.
grant select                 on profiles  to service_role;
grant select, insert, update on customers to service_role;
