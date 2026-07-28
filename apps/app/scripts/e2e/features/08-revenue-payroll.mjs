// FEATURE: the two money ties the state machine never asserted, driven live end-to-end —
//  (1) delivering an order RECOGNIZES exactly its value in the revenue book (ASC 606: booking ≠ revenue,
//      revenue lands on delivery), and
//  (2) that same delivered order accrues staff commission that run_payroll settles — once, idempotently.
//
// The existing suites drive the order states and seed the wallet directly; nothing walked a real order
// from money-in through delivery and watched the recognized top line and the payroll both move by the
// right amount. This does.
import { group, check, eq, allowed, rows, svc, AGENCY, ACME, MAI } from '../lib.mjs';

const code = (p) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const recognized = async (admin) =>
  Number((await allowed(admin.rpc('revenue_book', { p_window_days: 30 }), 'revenue_book')).total.recognized);

export async function run(ctx) {
  // Determinism: make sure Mai's pod manager isn't auto-delivering or auto-assigning under us, so the
  // manual walk below is the only thing that moves this order.
  await allowed(ctx.manager.rpc('set_auto_review', { p_on: false }), 'auto-review off');
  await allowed(ctx.manager.rpc('set_away_auto_assign', { p_on: false }), 'away off');

  group('Revenue recognition — delivering an order books its value (ASC 606)');
  const V = 120;
  const rec0 = await recognized(ctx.admin);
  await allowed(svc.rpc('topup', { p_tenant: AGENCY, p_customer: ACME, p_amount: 500, p_actor: null }), 'topup');
  const oid = (await allowed(svc.rpc('create_order',
    { p_tenant: AGENCY, p_customer: ACME, p_code: code('RP'), p_service: 'Backlink', p_value: V, p_actor: null }), 'create_order')).id;

  await check('a placed-but-undelivered order recognizes NOTHING (booking ≠ revenue)', async () => {
    eq(Number(((await recognized(ctx.admin)) - rec0).toFixed(2)), 0, 'placing an order does not move recognized');
  });

  // walk it to delivered through the real roles
  await allowed(ctx.admin.rpc('assign_order', { p_order: oid, p_staff: MAI }), 'assign');
  await allowed(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'in_progress' }), 'start');
  await allowed(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'internal_review' }), 'submit');
  await allowed(ctx.admin.rpc('advance_order', { p_order: oid, p_to: 'delivered' }), 'deliver');

  await check('delivering recognizes EXACTLY the order value', async () => {
    eq(Number(((await recognized(ctx.admin)) - rec0).toFixed(2)), V, 'recognized rose by the delivered value, no more');
  });

  group('Affiliate — the customer approving a referred order pays the referrer');
  // ACME (jane@acme.com) was referred by the affiliate (JANESEO, bronze 10%), so approving her order
  // posts commission to the affiliate's wallet — live, through the real customer + affiliate sessions.
  const affBalance = () => rows(ctx.affiliate.from('affiliate_commission').select('balance'), 'aff balance')
    .then((r) => Number(r.at(0)?.balance ?? 0));
  const affBefore = await affBalance();
  await allowed(ctx.customer.rpc('advance_order', { p_order: oid, p_to: 'approved' }), 'customer approves');
  await check('approving a referred order posts value × 10% to the affiliate wallet', async () => {
    eq(Number(((await affBalance()) - affBefore).toFixed(2)), Number((V * 0.10).toFixed(2)),
       'affiliate wallet rose by exactly the referred commission');
  });

  group('Payroll — the delivered order accrues commission that run_payroll settles, once');
  const BASE = 1000, PCT = 10;
  await allowed(ctx.admin.rpc('set_staff_comp', { p_profile: MAI, p_base: BASE, p_pct: PCT }), 'set_staff_comp');
  const period = new Date().toISOString().slice(0, 7);        // the month we just delivered in
  const commission = Number((V * PCT / 100).toFixed(2));      // PCT% of the delivered value = 12.00
  const runsBefore = (await rows(ctx.admin.from('payroll_runs').select('id').eq('staff_id', MAI).eq('period', period), 'runs before')).length;

  let run1;
  await check('run_payroll records base + the commission the delivery accrued', async () => {
    run1 = await allowed(ctx.admin.rpc('run_payroll',
      { p_staff: MAI, p_period: period, p_salary: BASE, p_gig: 0, p_bonus: 0, p_commission: commission }), 'run_payroll');
    eq(Number(run1.commission), commission, 'commission leg == PCT% of delivered value');
    eq(Number(run1.total), BASE + commission, 'total == base + commission');
  });

  await check('re-running the same period is idempotent — no second row, no double pay', async () => {
    const again = await allowed(ctx.admin.rpc('run_payroll',
      { p_staff: MAI, p_period: period, p_salary: 9999, p_gig: 9999, p_bonus: 9999, p_commission: 9999 }), 're-run');
    eq(again.id, run1.id, 'the same run row is returned');
    eq(Number(again.total), BASE + commission, 'amounts stay put despite different inputs');
    const runsAfter = (await rows(ctx.admin.from('payroll_runs').select('id').eq('staff_id', MAI).eq('period', period), 'runs after')).length;
    eq(runsAfter, runsBefore + 1, 'exactly one payroll row exists for this worker + period');
  });
}
