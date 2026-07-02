/* eslint-disable no-empty */
import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { login, ACCOUNTS } from './helpers';

// ────────────────────────────────────────────────────────────────────────────────────────────────
// AUTO-ASSIGN LIFECYCLE DEMO — two buyers, two entry points (dashboard + marketing), then auto-assign
// → staff → manager review/revise → deliver → customer approve/revise. Captures a screenshot per step.
// UI moments are driven through the real app; mechanical state moves use role-authenticated RPC.
// NOTE: service_role is REVOKED from direct table access (money-mint hardening), so every DB read here
// goes through an authenticated client (admin reads orders; staff reads own deliverables). The "rest of
// the team is at capacity" pre-req is applied via psql by the runner before this spec.
// ────────────────────────────────────────────────────────────────────────────────────────────────

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SMOKE_ANON!;
const MARKETING = 'http://localhost:4321';
const SHOTS = process.env.SHOTS || '/private/tmp/claude-501/-Users-huy-Desktop-Projects-Web2-hevaseo-platform/ee2814f6-f9ed-4c8c-9e62-d099dfc8570d/scratchpad/demo-shots';
const MAI = 'b000aaaa-0000-4000-8000-000000000003';

async function as(email: string, password = 'demo1234'): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}
const orderIdByCode = async (db: SupabaseClient, code: string): Promise<string> => {
  const { data } = await db.from('orders').select('id').eq('code', code).maybeSingle();
  if (!data) throw new Error(`order ${code} not found`);
  return data.id as string;
};
const stateOf = async (db: SupabaseClient, id: string): Promise<string> => {
  const { data } = await db.from('orders').select('state').eq('id', id).single();
  return data!.state as string;
};
const latestDeliverable = async (db: SupabaseClient, orderId: string): Promise<string> => {
  const { data } = await db.from('deliverables').select('id').eq('order_id', orderId).order('version', { ascending: false }).limit(1).single();
  return data!.id as string;
};

test('auto-assign lifecycle demo (dashboard + marketing → staff → manager → customer)', async ({ browser }) => {
  test.setTimeout(300_000);
  let shot = 0;
  const cap = async (page: Page, name: string) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${String(++shot).padStart(2, '0')}_${name}.png` });
  };
  const fillForm = async (page: Page, scope = 'form') => {
    for (const inp of await page.locator(`${scope} input:visible`).all()) {
      const type = (await inp.getAttribute('type')) ?? 'text';
      if (['checkbox', 'radio', 'file', 'hidden', 'range', 'submit'].includes(type)) continue;
      const name = (await inp.getAttribute('name')) ?? '';
      if (name === 'email' || name === 'name') continue; // set explicitly by the caller
      const v = type === 'email' ? 'qa@e2e.test' : type === 'url' ? 'https://demo.example.com' : type === 'number' ? '1' : 'Demo order';
      await inp.fill(v).catch(() => {});
    }
    for (const ta of await page.locator(`${scope} textarea:visible`).all()) await ta.fill('Please focus on the priority keywords and the homepage.').catch(() => {});
    for (const sel of await page.locator(`${scope} select:visible`).all()) await sel.selectOption({ index: 1 }).catch(() => {});
  };

  const buyerEmail = `demo.buyer.${Date.now().toString(36)}@example.com`;
  const adminDb = await as(ACCOUNTS.admin); // authenticated reads (service_role can't SELECT tables)

  // ══ LUỒNG B — marketing quick-checkout (anonymous visitor) ═══════════════════════════════════════
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pB = await ctxB.newPage();
  await pB.goto(`${MARKETING}/order/content`, { waitUntil: 'domcontentloaded' });
  await pB.locator('input[name="package"]').first().check({ force: true }).catch(() => {});
  await pB.locator('input[name="email"]').first().fill(buyerEmail).catch(() => {});
  await pB.locator('input[name="name"]').first().fill('Marketing Buyer').catch(() => {});
  await fillForm(pB, '#order-form');
  await cap(pB, 'marketing_order_config'); // 01

  await pB.getByRole('button', { name: /Continue to payment/i }).click();
  await pB.locator('#order-payment').waitFor({ state: 'visible' });
  await pB.locator('#bill-name').fill('Marketing Buyer');
  await pB.locator('#bill-address').fill('100 Market St');
  await pB.locator('#bill-city').fill('San Francisco');
  await pB.locator('#bill-postal').fill('94105');
  await pB.locator('#bill-country').selectOption({ index: 1 }).catch(() => {});
  await pB.locator('#pay-card').fill('4242 4242 4242 4242').catch(() => {});
  await pB.locator('#pay-exp').fill('12/30').catch(() => {});
  await pB.locator('#pay-cvc').fill('123').catch(() => {});
  await pB.locator('#pay-name').fill('Marketing Buyer').catch(() => {});
  await cap(pB, 'marketing_payment'); // 02

  await pB.locator('#pay-submit').click();
  await pB.locator('#order-success').waitFor({ state: 'visible', timeout: 20_000 });
  const marketingCode = (await pB.locator('#success-code').textContent())?.trim() || '';
  const buyerPass = (await pB.locator('#cred-pass').textContent())?.trim() || 'demo1234';
  await cap(pB, 'marketing_success'); // 03
  await ctxB.close();
  expect(marketingCode).toMatch(/^QO-/);

  // ══ LUỒNG A — dashboard order (existing customer Jane) ══════════════════════════════════════════
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pA = await ctxA.newPage();
  await login(pA, ACCOUNTS.customer);
  await pA.goto('/services/audit', { waitUntil: 'domcontentloaded' });
  await fillForm(pA);
  await cap(pA, 'dashboard_order_config'); // 04
  await pA.getByRole('button', { name: /Place order/i }).first().click();
  await expect(pA).toHaveURL(/\/orders(\b|\?|$)/, { timeout: 15_000 });
  await cap(pA, 'dashboard_orders_after'); // 05
  await ctxA.close();

  const dashCode = (await adminDb.from('orders').select('code').like('code', 'AD-%').order('created_at', { ascending: false }).limit(1).maybeSingle()).data?.code as string;
  const mId = await orderIdByCode(adminDb, marketingCode);
  const dId = await orderIdByCode(adminDb, dashCode);

  // ══ AUTO-ASSIGN (admin board) ══════════════════════════════════════════════════════════════════
  // Prereq: confirm both orders (assign_order only advances confirmed→assigned). The rest of the team
  // is fully booked (capacity 0, applied by the runner) → the load-aware router routes both to the one
  // available specialist, Mai (who is also in Sofia's pod, so Sofia can review).
  await adminDb.rpc('advance_order', { p_order: mId, p_to: 'confirmed' });
  await adminDb.rpc('advance_order', { p_order: dId, p_to: 'confirmed' });

  const ctxAd = await browser.newContext({ viewport: { width: 1560, height: 950 } });
  const pAd = await ctxAd.newPage();
  await login(pAd, ACCOUNTS.admin);
  await pAd.goto('/admin/assignment', { waitUntil: 'domcontentloaded' });
  await expect(pAd.getByText(marketingCode).first()).toBeVisible({ timeout: 15_000 });
  await cap(pAd, 'assign_before'); // 06

  await pAd.getByRole('button', { name: /Auto-assign all/i }).click();
  await expect.poll(async () => {
    const { data } = await adminDb.from('orders').select('assignee_id').in('id', [mId, dId]);
    return (data ?? []).every((o) => o.assignee_id === MAI);
  }, { timeout: 15_000 }).toBe(true);
  await pAd.waitForTimeout(600);
  await cap(pAd, 'assign_after'); // 07
  await ctxAd.close();

  // ══ STAFF (Mai) — sees both tasks; submits the marketing order for review ═══════════════════════
  const staff = await as(ACCOUNTS.staff);
  const ctxS = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pS = await ctxS.newPage();
  await login(pS, ACCOUNTS.staff);
  await pS.goto('/staff/tasks', { waitUntil: 'domcontentloaded' });
  await expect(pS.getByText(marketingCode).first()).toBeVisible({ timeout: 15_000 });
  await cap(pS, 'staff_tasks'); // 08

  await staff.rpc('advance_order', { p_order: mId, p_to: 'in_progress' });
  await pS.goto(`/staff/tasks/${mId}`, { waitUntil: 'domcontentloaded' });
  const note = pS.locator('#deliverable-note');
  await note.waitFor({ state: 'visible', timeout: 10_000 });
  await pS.locator('input[placeholder*="external link"]').first().fill('https://docs.example.com/content-draft-v1');
  await note.fill('Draft v1 — 8 articles, on-page optimized, ready for QA.');
  await cap(pS, 'staff_submit'); // 09
  await pS.getByRole('button', { name: /Submit v\d+ for review/i }).click();
  await expect(pS.getByText(/Submitted for review/i).first()).toBeVisible({ timeout: 15_000 });
  await ctxS.close();
  expect(await stateOf(adminDb, mId)).toBe('internal_review');

  // ══ MANAGER (Sofia) — pod review: request changes on the marketing order (revision loop) ════════
  const manager = await as(ACCOUNTS.manager);
  const ctxM = await browser.newContext({ viewport: { width: 1560, height: 950 } });
  const pM = await ctxM.newPage();
  await login(pM, ACCOUNTS.manager);
  await pM.goto('/manager/review', { waitUntil: 'domcontentloaded' });
  await expect(pM.getByText(marketingCode).first()).toBeVisible({ timeout: 15_000 });
  await pM.getByText(marketingCode).first().click();
  await pM.getByRole('button', { name: /Request changes/i }).first().click();
  await pM.locator('textarea[placeholder*="needs to change"]').fill('Please tighten the intros and add internal links to the pillar pages.');
  await cap(pM, 'manager_request_changes'); // 10
  await pM.getByRole('button', { name: /Send back/i }).click();
  await expect.poll(() => stateOf(adminDb, mId), { timeout: 15_000 }).toBe('changes_requested');

  // staff revises + resubmits (mechanical)
  await staff.rpc('advance_order', { p_order: mId, p_to: 'in_progress' });
  await staff.rpc('submit_deliverable', { p_order: mId, p_summary: 'v2 — intros tightened, internal links added.', p_files: [] });
  await staff.rpc('advance_order', { p_order: mId, p_to: 'internal_review' });

  // manager approves → delivered
  await pM.reload();
  await expect(pM.getByText(marketingCode).first()).toBeVisible({ timeout: 15_000 });
  await pM.getByText(marketingCode).first().click();
  for (const cb of await pM.locator('input[type="checkbox"]:visible').all()) await cb.check().catch(() => {});
  await cap(pM, 'manager_approve'); // 11
  await pM.getByRole('button', { name: /^Approve/ }).first().click();
  await expect.poll(() => stateOf(adminDb, mId), { timeout: 15_000 }).toBe('delivered');
  await ctxM.close();

  // Drive the DASHBOARD order to 'delivered' via the correct roles too, so the customer strip shows it.
  await staff.rpc('advance_order', { p_order: dId, p_to: 'in_progress' });
  await staff.rpc('submit_deliverable', { p_order: dId, p_summary: 'Audit v1 — 40 findings across tech + on-page.', p_files: [] });
  await staff.rpc('advance_order', { p_order: dId, p_to: 'internal_review' });
  await manager.rpc('review_deliverable', { p_deliverable: await latestDeliverable(staff, dId), p_action: 'approve', p_note: null });
  await manager.rpc('advance_order', { p_order: dId, p_to: 'delivered' });

  // ══ CUSTOMER — the review strip opens the full panel where Approve / Request changes live ═════════
  // Jane (dashboard order): open it from the strip and send it back for revision.
  const ctxJ = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pJ = await ctxJ.newPage();
  await login(pJ, ACCOUNTS.customer);
  await pJ.goto('/orders', { waitUntil: 'domcontentloaded' });
  await expect(pJ.getByText(/ready for review/i).first()).toBeVisible({ timeout: 15_000 });
  await cap(pJ, 'customer_delivered_strip'); // 12
  await pJ.getByText(dashCode).first().click(); // open the shared order-detail panel
  const jReq = pJ.getByRole('button', { name: /Request changes/i });
  await expect(jReq).toBeEnabled({ timeout: 10_000 });
  await cap(pJ, 'customer_request_changes'); // 13
  await jReq.click();
  await expect.poll(() => stateOf(adminDb, dId), { timeout: 15_000 }).toBe('changes_requested');
  await ctxJ.close();

  // staff reworks the dashboard order; manager re-delivers (mechanical)
  await staff.rpc('advance_order', { p_order: dId, p_to: 'in_progress' });
  await staff.rpc('submit_deliverable', { p_order: dId, p_summary: 'Audit v2 — added competitor gap + Core Web Vitals.', p_files: [] });
  await staff.rpc('advance_order', { p_order: dId, p_to: 'internal_review' });
  await manager.rpc('review_deliverable', { p_deliverable: await latestDeliverable(staff, dId), p_action: 'approve', p_note: null });
  await manager.rpc('advance_order', { p_order: dId, p_to: 'delivered' });

  // Jane approves the revised dashboard order (via the panel).
  const ctxJ2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pJ2 = await ctxJ2.newPage();
  await login(pJ2, ACCOUNTS.customer);
  await pJ2.goto('/orders', { waitUntil: 'domcontentloaded' });
  await expect(pJ2.getByText(/ready for review/i).first()).toBeVisible({ timeout: 15_000 });
  await pJ2.getByText(dashCode).first().click();
  const jApprove = pJ2.getByRole('button', { name: /Approve delivery/i });
  await expect(jApprove).toBeEnabled({ timeout: 10_000 });
  await jApprove.click();
  await expect.poll(() => stateOf(adminDb, dId), { timeout: 15_000 }).toBe('approved');
  await cap(pJ2, 'customer_approve'); // 14
  await ctxJ2.close();

  // The marketing buyer approves their delivered order (fresh provisioned account, temp password).
  const ctxBuy = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pBuy = await ctxBuy.newPage();
  await login(pBuy, buyerEmail, buyerPass);
  await pBuy.goto('/orders', { waitUntil: 'domcontentloaded' });
  await expect(pBuy.getByText(/ready for review/i).first()).toBeVisible({ timeout: 15_000 });
  await pBuy.getByText(marketingCode).first().click();
  const bApprove = pBuy.getByRole('button', { name: /Approve delivery/i });
  await expect(bApprove).toBeEnabled({ timeout: 10_000 });
  await bApprove.click();
  await expect.poll(() => stateOf(adminDb, mId), { timeout: 15_000 }).toBe('approved');
  await ctxBuy.close();

  // admin completes both + final board
  await adminDb.rpc('advance_order', { p_order: mId, p_to: 'completed' });
  await adminDb.rpc('advance_order', { p_order: dId, p_to: 'completed' });
  const ctxF = await browser.newContext({ viewport: { width: 1560, height: 950 } });
  const pF = await ctxF.newPage();
  await login(pF, ACCOUNTS.admin);
  await pF.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
  await cap(pF, 'admin_orders_final'); // 15
  await ctxF.close();

  expect(await stateOf(adminDb, mId)).toBe('completed');
  expect(await stateOf(adminDb, dId)).toBe('completed');
});
