-- SECURITY regression guard for 20260701400000_harden_post_commission.
-- post_staff_pay / post_affiliate_commission are server-computed money-in (SECURITY DEFINER, wallet
-- credit, no in-fn role gate) → ONLY service_role may execute them. Previously they defaulted to
-- EXECUTE-to-PUBLIC, letting anon/authenticated mint arbitrary wallet balance via rpc(). These asserts
-- fail loudly if a future migration re-widens the grant (mirrors 0200_fn_create_order_test).
begin;
select plan(6);

select has_function('post_staff_pay', 'post_staff_pay() exists');
select has_function('post_affiliate_commission', 'post_affiliate_commission() exists');

-- the API roles must NOT be able to execute these money-in functions
select ok(
  not has_function_privilege('authenticated', 'post_staff_pay(uuid,uuid,numeric,numeric,uuid)', 'execute'),
  'authenticated CANNOT execute post_staff_pay (service-role only)');
select ok(
  not has_function_privilege('anon', 'post_staff_pay(uuid,uuid,numeric,numeric,uuid)', 'execute'),
  'anon CANNOT execute post_staff_pay');
select ok(
  not has_function_privilege('authenticated', 'post_affiliate_commission(uuid,uuid,numeric,uuid)', 'execute'),
  'authenticated CANNOT execute post_affiliate_commission (service-role only)');
select ok(
  not has_function_privilege('anon', 'post_affiliate_commission(uuid,uuid,numeric,uuid)', 'execute'),
  'anon CANNOT execute post_affiliate_commission');

select * from finish();
rollback;
