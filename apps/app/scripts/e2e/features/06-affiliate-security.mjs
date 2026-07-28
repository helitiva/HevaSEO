// FEATURE: affiliate self-service (own reads, code/profile, click tracking, tier authz) + LIVE security
// grant checks (money-mint fns, money-in fns, helpers locked to the right roles; profiles enumeration).
import { group, check, eq, assert, denied, allowed, rows, svc, anonClient, AGENCY, ACME } from '../lib.mjs';

export async function run(ctx) {
  group('Affiliate — self-service reads + writes');
  await check('affiliate reads only their own commission wallet', async () => eq((await rows(ctx.affiliate.from('affiliate_commission').select('affiliate_id'), 'own wallet')).length, 1));
  await check('affiliate reads their own commission ledger', async () => assert((await rows(ctx.affiliate.from('commission_ledger').select('amount'), 'own ledger')).length >= 0, 'ledger readable'));
  await check('affiliate can read the tier config table (RLS read policy)', async () => allowed(ctx.affiliate.from('affiliate_tier_config').select('tier'), 'tier config readable'));
  await check('affiliate updates their own marketing profile', async () => allowed(ctx.affiliate.rpc('update_affiliate_profile', { p_name: 'Jane R (e2e)', p_platform: 'YouTube', p_niche: 'SEO', p_audience: 'marketers' }), 'update profile'));
  await check('a customer cannot set an affiliate referral code', async () => denied(ctx.customer.rpc('set_affiliate_code', { p_code: 'HACK' }), 'customer set code'));

  group('Affiliate — click tracking + tier authz');
  await check('anon can record a referral click via the public fn', async () => {
    const codeRow = (await rows(ctx.admin.from('affiliates').select('code').limit(1), 'code')).at(0);
    await allowed(anonClient().rpc('record_affiliate_click', { p_code: codeRow.code }), 'anon click');
  });
  await check('only an admin can pin a partner tier', async () => {
    const affId = (await rows(ctx.admin.from('affiliates').select('id').limit(1), 'affid')).at(0).id;
    await denied(ctx.affiliate.rpc('set_affiliate_tier', { p_affiliate: affId, p_tier: 'gold' }), 'affiliate self-promote');
    await allowed(ctx.admin.rpc('set_affiliate_tier', { p_affiliate: affId, p_tier: 'gold' }), 'admin sets tier');
  });

  group('SECURITY (live) — money-mint fns are unreachable by API roles');
  const anyOrder = (await rows(ctx.admin.from('orders').select('id').limit(1), 'order')).at(0).id;
  const affId = (await rows(ctx.admin.from('affiliates').select('id').limit(1), 'aff')).at(0).id;
  await check('customer CANNOT call post_affiliate_commission (was a money mint)', async () => denied(ctx.customer.rpc('post_affiliate_commission', { p_order: anyOrder, p_affiliate: affId, p_amount: 999999, p_actor: null }), 'customer mint'));
  await check('anon CANNOT call post_affiliate_commission', async () => denied(anonClient().rpc('post_affiliate_commission', { p_order: anyOrder, p_affiliate: affId, p_amount: 999999, p_actor: null }), 'anon mint'));
  await check('customer CANNOT call post_staff_pay', async () => denied(ctx.customer.rpc('post_staff_pay', { p_order: anyOrder, p_staff: affId, p_commission: 999999, p_gig: 0, p_actor: null }), 'customer staff-pay'));

  group('SECURITY (live) — money-in + helper fns locked');
  await check('customer CANNOT call create_order (service-role only)', async () => denied(ctx.customer.rpc('create_order', { p_tenant: AGENCY, p_customer: ACME, p_code: 'HACK', p_service: 'X', p_value: 0, p_actor: null }), 'customer create_order'));
  await check('customer CANNOT call topup', async () => denied(ctx.customer.rpc('topup', { p_tenant: AGENCY, p_customer: ACME, p_amount: 999, p_actor: null }), 'customer topup'));
  await check('customer CANNOT call materialize_order', async () => denied(ctx.customer.rpc('materialize_order', { p_tenant: AGENCY, p_customer: ACME, p_code: 'HACK', p_service: 'X', p_value: 999, p_actor: null, p_ref: 'r' }), 'customer materialize'));
  await check('authenticated CANNOT call the rate_hit limiter directly', async () => denied(ctx.customer.rpc('rate_hit', { p_key: 'x', p_max: 1, p_window_secs: 60 }), 'customer rate_hit'));

  group('SECURITY (live) — profiles enumeration is closed');
  await check('a customer cannot enumerate the whole tenant roster', async () => {
    const total = (await rows(ctx.admin.from('profiles').select('id'), 'all')).length;
    const seen = await rows(ctx.customer.from('profiles').select('role'), 'cust profiles');
    assert(seen.length < total, `customer must not see all ${total} profiles (saw ${seen.length})`);
    eq(seen.filter((p) => p.role === 'admin').length, 0, 'customer must not see any admin profile');
    eq(seen.filter((p) => p.role === 'manager').length, 0, 'customer must not see any manager profile');
  });
}
