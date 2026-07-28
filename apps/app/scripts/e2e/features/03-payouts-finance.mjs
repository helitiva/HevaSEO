// FEATURE: staff & affiliate payouts (request → admin resolve/reject-refund), penalties, payroll.
// Reads use the owner client for wallets (money-blind: only the owner sees their wallet) and the admin
// client for orders/affiliates. Writes go through the SECURITY DEFINER fns (svc for service-role-only).
import { group, check, eq, assert, denied, allowed, rows, svc, AGENCY, MAI } from '../lib.mjs';

const staffBal = (ctx) => rows(ctx.staff.from('staff_wallet').select('balance'), 'staff bal').then((r) => Number(r.at(0).balance));

export async function run(ctx) {
  // guarantee Mai has withdrawable balance via the real service-role commission fn
  const maiOrder = (await rows(ctx.admin.from('orders').select('id').eq('assignee_id', MAI).limit(1), 'mai order')).at(0);
  if (maiOrder) await allowed(svc.rpc('post_staff_pay', { p_order: maiOrder.id, p_staff: MAI, p_commission: 300, p_gig: 0, p_actor: null }), 'seed mai wallet');

  group('Staff payout — claims-derived request + admin resolve');
  await check('below-min ($<50) request is rejected', async () => denied(ctx.staff.rpc('request_payout', { p_amount: 10 }), 'below min'));
  await check('a customer cannot request a staff payout', async () => denied(ctx.customer.rpc('request_payout', { p_amount: 50 }), 'customer payout'));
  let staffReq;
  await check('staff requests $50 → wallet debited, request row created', async () => {
    const before = await staffBal(ctx);
    staffReq = await allowed(ctx.staff.rpc('request_payout', { p_amount: 50 }), 'request_payout');
    eq(Number((before - await staffBal(ctx)).toFixed(2)), 50, 'wallet debited by 50');
  });
  await check('a staffer cannot resolve their own payout (admin only)', async () => denied(ctx.staff.rpc('resolve_payout', { p_request: staffReq.id, p_action: 'pay' }), 'staff self-resolve'));
  await check('admin rejects → held amount refunded, invariant holds', async () => {
    const before = await staffBal(ctx);
    await allowed(ctx.admin.rpc('resolve_payout', { p_request: staffReq.id, p_action: 'reject' }), 'reject');
    const after = await staffBal(ctx);
    eq(Number((after - before).toFixed(2)), 50, 'reject refunds 50');
    const sum = (await rows(ctx.staff.from('wallet_ledger').select('amount'), 'wl')).reduce((s, r) => s + Number(r.amount), 0);
    eq(after, Number(sum.toFixed(2)), 'balance == SUM(wallet_ledger) after refund');
  });
  await check('a resolved (rejected) payout cannot be re-resolved', async () => denied(ctx.admin.rpc('resolve_payout', { p_request: staffReq.id, p_action: 'pay' }), 're-resolve'));

  group('Affiliate payout — request + admin reject-refund + min enforcement');
  const affId = (await rows(ctx.affiliate.from('affiliates').select('id'), 'affid')).at(0).id;
  const affBal = () => rows(ctx.affiliate.from('affiliate_commission').select('balance'), 'ab').then((r) => Number(r.at(0)?.balance ?? 0));
  await check('below-min affiliate request rejected', async () => denied(ctx.affiliate.rpc('request_affiliate_payout', { p_amount: 5 }), 'aff below min'));
  await check('a customer cannot request an affiliate payout', async () => denied(ctx.customer.rpc('request_affiliate_payout', { p_amount: 50 }), 'customer aff payout'));
  await check('affiliate requests $50 then admin reject refunds it (invariant holds)', async () => {
    if (await affBal() < 50) {
      const anyOrder = (await rows(ctx.admin.from('orders').select('id').limit(1), 'o')).at(0).id;
      await allowed(svc.rpc('post_affiliate_commission', { p_order: anyOrder, p_affiliate: affId, p_amount: 100, p_actor: null }), 'seed aff');
    }
    const req = await allowed(ctx.affiliate.rpc('request_affiliate_payout', { p_amount: 50 }), 'aff request');
    await allowed(ctx.admin.rpc('resolve_affiliate_payout', { p_request: req.id, p_action: 'reject' }), 'aff reject');
    const balNow = await affBal();
    const sum = (await rows(ctx.affiliate.from('commission_ledger').select('amount'), 'cl')).reduce((s, r) => s + Number(r.amount), 0);
    eq(balNow, Number(sum.toFixed(2)), 'affiliate balance == SUM(commission_ledger) after refund');
  });

  group('Penalties — apply (admin) → dispute (staff) → waive (admin) refunds');
  await check('penalty lifecycle keeps the wallet invariant', async () => {
    const before = await staffBal(ctx);
    const pen = await allowed(ctx.admin.rpc('apply_penalty', { p_staff: MAI, p_amount: 25, p_type: 'manual', p_detail: 'e2e test' }), 'apply_penalty');
    eq(Number((before - await staffBal(ctx)).toFixed(2)), 25, 'penalty debits 25');
    await allowed(ctx.staff.rpc('dispute_penalty', { p_id: pen.id, p_note: 'not my fault' }), 'dispute');
    await allowed(ctx.admin.rpc('waive_penalty', { p_id: pen.id }), 'waive');
    eq(await staffBal(ctx), before, 'waive refunds the penalty in full');
  });
  await check('a customer cannot apply a penalty', async () => denied(ctx.customer.rpc('apply_penalty', { p_staff: MAI, p_amount: 10, p_type: 'manual', p_detail: 'x' }), 'customer penalty'));

  group('Payroll — admin-gated, idempotent per period');
  const payrollArgs = { p_staff: MAI, p_period: '2026-05', p_salary: 100, p_gig: 0, p_bonus: 0 };
  await check('a non-admin cannot run payroll', async () => denied(ctx.staff.rpc('run_payroll', payrollArgs), 'staff payroll'));
  await check('admin can run payroll for a period', async () => allowed(ctx.admin.rpc('run_payroll', payrollArgs), 'admin payroll'));
  await check('re-running the same period is idempotent (no double pay)', async () => {
    const before = await staffBal(ctx);
    await allowed(ctx.admin.rpc('run_payroll', payrollArgs), 'admin payroll again');
    eq(await staffBal(ctx), before, 'second run for the same period must not pay again');
  });
}
