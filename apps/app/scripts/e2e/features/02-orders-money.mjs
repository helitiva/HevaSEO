// FEATURE: Order lifecycle (transitions, ownership, forgery) + money invariant (balance == SUM(ledger)).
import { group, check, eq, assert, denied, allowed, rows, svc, AGENCY, ACME } from '../lib.mjs';

const code = (p) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export async function run(ctx) {
  group('Orders — lifecycle via SECURITY DEFINER fns');
  await allowed(svc.rpc('topup', { p_tenant: AGENCY, p_customer: ACME, p_amount: 500, p_actor: null }), 'seed topup');
  const created = await allowed(svc.rpc('create_order', { p_tenant: AGENCY, p_customer: ACME, p_code: code('E2E'), p_service: 'Keyword', p_value: 80, p_actor: null }), 'create_order');
  const oid = created.id;
  await check('service-role create_order → state new', async () => eq(created.state, 'new'));
  await check('admin advances new → confirmed (legal transition)', async () => eq((await allowed(ctx.admin.rpc('advance_order', { p_order: oid, p_to: 'confirmed' }), 'advance')).state, 'confirmed'));
  await check('illegal transition confirmed → completed is rejected', async () => denied(ctx.admin.rpc('advance_order', { p_order: oid, p_to: 'completed' }), 'illegal transition'));
  await check('customer forging advance is BLOCKED', async () => denied(ctx.customer.rpc('advance_order', { p_order: oid, p_to: 'assigned' }), 'customer forge advance'));
  await check('staff cannot advance an order not assigned to them', async () => denied(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'assigned' }), 'staff advance foreign'));

  group('Orders — cancel refunds 95% and keeps a 5% fee');
  const c2 = await allowed(svc.rpc('create_order', { p_tenant: AGENCY, p_customer: ACME, p_code: code('CAN'), p_service: 'Audit', p_value: 100, p_actor: null }), 'create cancelable');
  const balBefore = Number((await rows(ctx.admin.from('customer_balances').select('balance').eq('customer_id', ACME), 'bal before')).at(0).balance);
  await check('admin cancels a planned order → canceled', async () => eq((await allowed(ctx.admin.rpc('cancel_order', { p_order: c2.id }), 'cancel')).state, 'canceled'));
  await check('refund credits 95% of value back (value 100 → +95 net)', async () => {
    const after = Number((await rows(ctx.admin.from('customer_balances').select('balance').eq('customer_id', ACME), 'bal after')).at(0).balance);
    eq(Number((after - balBefore).toFixed(2)), 95, 'net refund = value - 5% fee');
  });
  await check('staff cannot cancel an order', async () => {
    const planned = (await rows(ctx.admin.from('orders').select('id').eq('state', 'new').limit(1), 'planned')).at(0);
    await denied(ctx.staff.rpc('cancel_order', { p_order: planned.id }), 'staff cancel');
  });

  group('Money invariant — every wallet balance == SUM(its ledger)');
  await check('customer credit: balance == SUM(credit_ledger)', async () => {
    const bal = Number((await rows(ctx.admin.from('customer_balances').select('balance').eq('customer_id', ACME), 'bal')).at(0).balance);
    const sum = (await rows(ctx.admin.from('credit_ledger').select('amount').eq('customer_id', ACME), 'ledger')).reduce((s, r) => s + Number(r.amount), 0);
    eq(bal, Number(sum.toFixed(2)), 'customer invariant');
  });
  await check('staff wallet (own): balance == SUM(wallet_ledger)', async () => {
    const w = (await rows(ctx.staff.from('staff_wallet').select('balance'), 'staff wallet')).at(0);
    const sum = (await rows(ctx.staff.from('wallet_ledger').select('amount'), 'wl')).reduce((s, r) => s + Number(r.amount), 0);
    eq(Number(w.balance), Number(sum.toFixed(2)), 'staff wallet invariant');
  });
  await check('affiliate wallet (own): balance == SUM(commission_ledger)', async () => {
    const w = (await rows(ctx.affiliate.from('affiliate_commission').select('balance'), 'aff wallet')).at(0);
    const sum = (await rows(ctx.affiliate.from('commission_ledger').select('amount'), 'cl')).reduce((s, r) => s + Number(r.amount), 0);
    eq(Number(w.balance), Number(sum.toFixed(2)), 'affiliate wallet invariant');
  });
  await check('quick-checkout materialize_order is idempotent by checkout_ref', async () => {
    const ref = `e2e-ref-${Date.now()}`;
    const first = await allowed(svc.rpc('materialize_order', { p_tenant: AGENCY, p_customer: ACME, p_code: code('QO'), p_service: 'Content', p_value: 40, p_actor: null, p_ref: ref }), 'materialize 1');
    const again = await allowed(svc.rpc('materialize_order', { p_tenant: AGENCY, p_customer: ACME, p_code: code('QO'), p_service: 'Content', p_value: 40, p_actor: null, p_ref: ref }), 'materialize 2');
    eq(again.id, first.id, 'same ref must return the same order (no double charge)');
  });
}
