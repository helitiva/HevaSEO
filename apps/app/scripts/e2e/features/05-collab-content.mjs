// FEATURE: collaboration (deliverables, in-order messages incl. internal-note isolation) + docs/
// broadcasts array-RLS by audience.
import { group, check, eq, assert, denied, allowed, rows, svc, MAI, ACME } from '../lib.mjs';

export async function run(ctx) {
  const all = await rows(ctx.admin.from('orders').select('id,customer_id,assignee_id'), 'all orders');
  const maiOrder = all.find((o) => o.assignee_id === MAI);
  const jointOrder = all.find((o) => o.assignee_id === MAI && o.customer_id === ACME); // Jane's order assigned to Mai (KW-1013)
  const notMaiOrder = all.find((o) => o.assignee_id !== MAI);   // not assigned to Mai → staff submit denied
  const foreignCust = all.find((o) => o.customer_id !== ACME);  // another customer's order → customer post denied

  group('Deliverables — assignee submits, admin reviews');
  let deliv;
  await check('staff submits a deliverable on their assigned order', async () => {
    deliv = await allowed(ctx.staff.rpc('submit_deliverable', { p_order: maiOrder.id, p_summary: 'e2e draft', p_files: [] }), 'submit');
    assert(deliv?.id, 'a deliverable row is returned');
  });
  await check('staff cannot submit on an order not assigned to them', async () => denied(ctx.staff.rpc('submit_deliverable', { p_order: notMaiOrder.id, p_summary: 'x', p_files: [] }), 'foreign submit'));
  await check('a customer cannot submit a deliverable', async () => denied(ctx.customer.rpc('submit_deliverable', { p_order: maiOrder.id, p_summary: 'x', p_files: [] }), 'customer submit'));
  await check('admin reviews (approves) the deliverable', async () => allowed(ctx.admin.rpc('review_deliverable', { p_deliverable: deliv.id, p_action: 'approve', p_note: 'lgtm' }), 'review'));
  await check('a customer cannot review deliverables', async () => denied(ctx.customer.rpc('review_deliverable', { p_deliverable: deliv.id, p_action: 'approve', p_note: 'x' }), 'customer review'));

  group('Order messages — participant-gated + internal-note isolation');
  if (jointOrder) {
    await check('customer posts a message on their own order', async () => allowed(ctx.customer.rpc('post_order_message', { p_order: jointOrder.id, p_body: 'customer question', p_internal: false }), 'cust post'));
    await check('a customer message is forced non-internal (cannot post an internal note)', async () => {
      await allowed(ctx.customer.rpc('post_order_message', { p_order: jointOrder.id, p_body: 'sneaky', p_internal: true }), 'cust internal attempt');
      const mine = await rows(ctx.customer.from('order_messages').select('internal').eq('order_id', jointOrder.id), 'cust msgs');
      assert(mine.every((m) => m.internal === false), 'a customer must never author/see an internal note');
    });
    await check('assigned staff posts an INTERNAL note', async () => allowed(ctx.staff.rpc('post_order_message', { p_order: jointOrder.id, p_body: 'internal only', p_internal: true }), 'staff internal'));
    await check('customer does NOT see the internal note; staff does', async () => {
      const custRows = await rows(ctx.customer.from('order_messages').select('internal,body').eq('order_id', jointOrder.id), 'cust view');
      const staffRows = await rows(ctx.staff.from('order_messages').select('internal,body').eq('order_id', jointOrder.id), 'staff view');
      assert(custRows.every((m) => m.internal === false), 'customer view leaks an internal note');
      assert(staffRows.some((m) => m.internal === true), 'assigned staff should see the internal note');
    });
  } else {
    await check('customer posts a message on their own order (fallback)', async () => {
      const own = (await rows(ctx.customer.from('orders').select('id').limit(1), 'own')).at(0);
      await allowed(ctx.customer.rpc('post_order_message', { p_order: own.id, p_body: 'hi', p_internal: false }), 'cust post');
    });
  }
  await check('a customer cannot post on another customer\'s order', async () => denied(ctx.customer.rpc('post_order_message', { p_order: foreignCust.id, p_body: 'hack', p_internal: false }), 'foreign post'));

  group('Docs — array-RLS by audience');
  const custTitle = `E2E customer doc ${Date.now()}`;
  const staffTitle = `E2E staff-only ${Date.now()}`;
  await check('admin authors a customer doc and a staff-only doc', async () => {
    await allowed(ctx.admin.rpc('upsert_doc', { p_title: custTitle, p_body: {}, p_audiences: ['customer'], p_required_skills: [], p_pinned: false, p_id: undefined }), 'cust doc');
    await allowed(ctx.admin.rpc('upsert_doc', { p_title: staffTitle, p_body: {}, p_audiences: ['staff'], p_required_skills: [], p_pinned: false, p_id: undefined }), 'staff doc');
  });
  await check('customer sees the customer doc, NOT the staff-only doc', async () => {
    assert((await rows(ctx.customer.from('docs').select('id').eq('title', custTitle), 'cust sees cust doc')).length === 1, 'customer should see the customer doc');
    eq((await rows(ctx.customer.from('docs').select('id').eq('title', staffTitle), 'cust sees staff doc')).length, 0, 'customer must NOT see a staff-only doc');
  });
  await check('every doc a customer sees targets the customer audience', async () => {
    const custDocs = await rows(ctx.customer.from('docs').select('audiences'), 'all cust docs');
    assert(custDocs.every((x) => (x.audiences ?? []).includes('customer')), 'a customer must only see customer-audience docs');
  });

  group('Broadcasts — recipients see only their audience');
  await check('every broadcast a customer sees targets the customer audience', async () => {
    const b = await rows(ctx.customer.from('broadcasts').select('audiences,status'), 'cust broadcasts');
    assert(b.every((x) => (x.audiences ?? []).includes('customer')), 'customer must only see customer-audience broadcasts');
  });
  await check('every broadcast a staff user sees targets the staff audience', async () => {
    const b = await rows(ctx.staff.from('broadcasts').select('audiences'), 'staff broadcasts');
    assert(b.every((x) => (x.audiences ?? []).includes('staff')), 'staff must only see staff-audience broadcasts');
  });
}
