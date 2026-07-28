-- Phase 2 / inc-Q4: persist billing info captured at quick-checkout so the customer doesn't re-enter it
-- in the dashboard. Stored on the customer as jsonb (name/company/address/city/postal/country). Written
-- by the public checkout route handler (service role) only when the buyer ticks "save my billing".
alter table customers add column if not exists billing jsonb;
