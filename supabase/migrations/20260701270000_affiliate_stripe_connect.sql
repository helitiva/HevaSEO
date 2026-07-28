-- Lane E inc-E19: Stripe Connect onboarding for affiliate payouts. Each affiliate links a Stripe Express
-- connected account (created via the Stripe API server-side) so admin payouts can transfer to them. We
-- store the account id + whether Stripe has enabled payouts on it. affiliates is SELECT-only via RLS →
-- the affiliate writes these through the claims-derived SECURITY DEFINER fn below.
alter table affiliates
  add column if not exists stripe_account_id      text,
  add column if not exists stripe_payouts_enabled boolean not null default false;

create or replace function set_affiliate_stripe_account(p_account_id text, p_enabled boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_pid    uuid := current_profile_id();
  v_role   text := current_app_role();
  v_aff    uuid;
begin
  if v_role <> 'affiliate' then raise exception 'NOT_AFFILIATE'; end if;
  update affiliates
     set stripe_account_id = p_account_id, stripe_payouts_enabled = coalesce(p_enabled, false)
   where user_id = v_pid and tenant_id = v_tenant
   returning id into v_aff;
  if v_aff is null then raise exception 'NOT_AFFILIATE'; end if;
end $$;

revoke execute on function set_affiliate_stripe_account(text, boolean) from public;
grant  execute on function set_affiliate_stripe_account(text, boolean) to authenticated;
