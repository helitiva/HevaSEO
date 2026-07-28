// FEATURE: full order lifecycle + every interaction between staff, the pod manager (reviewer) and the
// customer — work → submit → manager review (request changes / approve) → deliver → customer approve or
// send back → complete, including both revision loops and the authz negatives.
import { group, check, eq, assert, denied, allowed, rows, svc, AGENCY, ACME, MAI } from '../lib.mjs';

const code = (p) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export async function run(ctx) {
  const stateOf = async (oid) => (await rows(ctx.admin.from('orders').select('state').eq('id', oid), 'state')).at(0)?.state;

  // Setup: a funded order for ACME, confirmed + assigned to Mai (whose pod manager is Sofia = ctx.manager).
  await allowed(svc.rpc('topup', { p_tenant: AGENCY, p_customer: ACME, p_amount: 200, p_actor: null }), 'topup');
  const ord = await allowed(svc.rpc('create_order', { p_tenant: AGENCY, p_customer: ACME, p_code: code('LC'), p_service: 'Audit', p_value: 60, p_actor: null }), 'create');
  const oid = ord.id;

  group('Setup — admin confirm + assign to staff');
  await check('admin confirms (new → confirmed)', async () => eq((await allowed(ctx.admin.rpc('advance_order', { p_order: oid, p_to: 'confirmed' }), 'confirm')).state, 'confirmed'));
  await check('admin assigns to Mai (confirmed → assigned)', async () => { await allowed(ctx.admin.rpc('assign_order', { p_order: oid, p_staff: MAI }), 'assign'); eq(await stateOf(oid), 'assigned'); });

  group('Staff works the task');
  await check('staff starts work (assigned → in_progress)', async () => eq((await allowed(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'in_progress' }), 'start')).state, 'in_progress'));
  await check('staff submits for review (in_progress → internal_review)', async () => eq((await allowed(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'internal_review' }), 'submit-state')).state, 'internal_review'));
  let d1;
  await check('staff submits deliverable v1', async () => { d1 = await allowed(ctx.staff.rpc('submit_deliverable', { p_order: oid, p_summary: 'v1 draft', p_files: [] }), 'submit v1'); assert(d1?.id, 'deliverable row returned'); });
  await check('authz−: staff cannot review their own deliverable', async () => denied(ctx.staff.rpc('review_deliverable', { p_deliverable: d1.id, p_action: 'approve', p_note: null }), 'staff review'));
  await check('authz−: staff cannot skip review→delivered (illegal transition)', async () => denied(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'delivered' }), 'staff deliver'));

  group('Manager review — request changes (revision loop 1)');
  await check('pod manager requests changes on v1', async () => { await allowed(ctx.manager.rpc('review_deliverable', { p_deliverable: d1.id, p_action: 'request_changes', p_note: 'tighten the summary' }), 'req changes'); });
  await check('pod manager moves order internal_review → changes_requested', async () => eq((await allowed(ctx.manager.rpc('advance_order', { p_order: oid, p_to: 'changes_requested' }), 'to changes')).state, 'changes_requested'));

  group('Staff revises + resubmits');
  await check('staff re-opens work (changes_requested → in_progress)', async () => eq((await allowed(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'in_progress' }), 'reopen')).state, 'in_progress'));
  await check('staff resubmits (in_progress → internal_review)', async () => eq((await allowed(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'internal_review' }), 'resubmit')).state, 'internal_review'));
  let d2;
  await check('staff submits deliverable v2', async () => { d2 = await allowed(ctx.staff.rpc('submit_deliverable', { p_order: oid, p_summary: 'v2 revised', p_files: [] }), 'submit v2'); assert(d2?.id, 'v2 row'); });

  group('Manager review — approve → deliver to customer');
  await check('pod manager approves v2', async () => allowed(ctx.manager.rpc('review_deliverable', { p_deliverable: d2.id, p_action: 'approve', p_note: null }), 'approve v2'));
  await check('pod manager delivers (internal_review → delivered)', async () => eq((await allowed(ctx.manager.rpc('advance_order', { p_order: oid, p_to: 'delivered' }), 'deliver')).state, 'delivered'));

  group('Customer — send back (revision loop 2) then approve');
  await check('authz−: customer cannot review a deliverable', async () => denied(ctx.customer.rpc('review_deliverable', { p_deliverable: d2.id, p_action: 'approve', p_note: null }), 'cust review'));
  await check('customer sends it back (delivered → changes_requested)', async () => eq((await allowed(ctx.customer.rpc('advance_order', { p_order: oid, p_to: 'changes_requested' }), 'cust changes')).state, 'changes_requested'));
  await check('staff reworks + resubmits, manager re-delivers', async () => {
    await allowed(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'in_progress' }), 're-open2');
    await allowed(ctx.staff.rpc('advance_order', { p_order: oid, p_to: 'internal_review' }), 're-submit2');
    const d3 = await allowed(ctx.staff.rpc('submit_deliverable', { p_order: oid, p_summary: 'v3 final', p_files: [] }), 'submit v3');
    await allowed(ctx.manager.rpc('review_deliverable', { p_deliverable: d3.id, p_action: 'approve', p_note: null }), 'approve v3');
    eq((await allowed(ctx.manager.rpc('advance_order', { p_order: oid, p_to: 'delivered' }), 'redeliver')).state, 'delivered');
  });
  await check('customer approves (delivered → approved)', async () => eq((await allowed(ctx.customer.rpc('advance_order', { p_order: oid, p_to: 'approved' }), 'cust approve')).state, 'approved'));

  group('Admin completes the order');
  await check('admin completes (approved → completed)', async () => eq((await allowed(ctx.admin.rpc('advance_order', { p_order: oid, p_to: 'completed' }), 'complete')).state, 'completed'));
  await check('money invariant intact after the full lifecycle', async () => {
    const bal = Number((await rows(ctx.admin.from('customer_balances').select('balance').eq('customer_id', ACME), 'bal')).at(0).balance);
    const sum = (await rows(ctx.admin.from('credit_ledger').select('amount').eq('customer_id', ACME), 'led')).reduce((s, r) => s + Number(r.amount), 0);
    eq(bal, Number(sum.toFixed(2)), 'balance == SUM(ledger)');
  });
}
