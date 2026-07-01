-- SECURITY hardening (gác③) — close a money-mint hole missed by 20260629130000_harden_order_write_fns.
--
-- Finding: post_staff_pay / post_affiliate_commission (20260629070003_fn_post_commission) are
-- SECURITY DEFINER wallet-credit functions that take the target staff/affiliate id + amount as
-- PARAMETERS with NO role/claims check, and — unlike every other money fn — were never given a
-- `revoke`/`grant`. Postgres defaults function EXECUTE to PUBLIC, so anon AND authenticated could call
-- them via PostgREST rpc() and credit any wallet by any amount. Proven: a plain customer minted
-- 999,999 into an affiliate commission wallet. The balance==SUM(ledger) invariant does NOT catch it
-- (the fn writes both sides), and the credited balance is then withdrawable via request_(affiliate_)payout
-- → admin pay → real Stripe Connect transfer.
--
-- Fix: same treatment as create_order/topup/materialize_order — these are server-computed money-in with
-- client-untrusted values, so ONLY service_role may call them (server actions / workers). There is no
-- app caller today (only seed.sql + pgTAP, which run as superuser), so this is a no-risk lockdown.
revoke execute on function post_staff_pay(uuid, uuid, numeric, numeric, uuid) from public, anon, authenticated;
revoke execute on function post_affiliate_commission(uuid, uuid, numeric, uuid) from public, anon, authenticated;
grant  execute on function post_staff_pay(uuid, uuid, numeric, numeric, uuid) to service_role;
grant  execute on function post_affiliate_commission(uuid, uuid, numeric, uuid) to service_role;
