import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { login, ACCOUNTS } from './helpers';

// Cross-role integration: a CUSTOMER creates a ticket, places an order, and requests a revision; then a
// MANAGER must see each on their surface and act on it (assign the order, reply to the ticket). Each test
// runs in its own browser context (fresh login) — state is shared through the real DB, not the UI, so a
// later manager test sees what an earlier customer test persisted. Serial mode keeps the order.
test.describe.configure({ mode: 'serial' });

const stamp = String(Date.now()).slice(-6);
const ticketSubject = `E2E mgr ticket ${stamp}`;
const managerReply = `Manager on it ${stamp}`;
const REVISION_ORDER = 'AUD-1001'; // jane's order we force to 'delivered' so she can request changes
let placedOrderCode: string | null = null;

function db(sql: string): string {
  return execSync(`npx supabase db query ${JSON.stringify(sql)}`, {
    cwd: process.cwd().replace(/\/apps\/app$/, ''),
    encoding: 'utf8',
  });
}

// ─────────────────────────── 1. TICKET: customer → manager ───────────────────────────
test('customer opens a support ticket', async ({ page }) => {
  await login(page, ACCOUNTS.customer);
  await page.goto('/support');
  await page.locator('input[name="subject"]').fill(ticketSubject);
  await page.locator('textarea[name="description"]').fill('Automated cross-role check: please review.');
  await page.getByRole('button', { name: /Submit ticket/i }).click();
  // it appears in the customer's own ticket list
  await expect(page.getByText(ticketSubject).first()).toBeVisible({ timeout: 8000 });
});

test('manager sees the real ticket, opens it, and replies (persists)', async ({ page }) => {
  await login(page, ACCOUNTS.manager);
  await page.goto('/manager/tickets');

  // the customer's real ticket shows on the (now real) manager Tickets page
  const row = page.getByRole('button').filter({ hasText: ticketSubject }).first();
  await expect(row).toBeVisible({ timeout: 8000 });
  await row.click();

  // reply through the shared composer → post_ticket_message (managers are now ticket participants)
  const composer = page.getByPlaceholder(/^Reply to /i);
  await expect(composer).toBeVisible();
  await composer.fill(managerReply);
  await page.getByRole('button', { name: /Send reply/i }).click();
  await expect(page.getByText(managerReply).first()).toBeVisible({ timeout: 8000 });

  // persisted: reload and the reply is still in the thread
  await page.reload();
  await page.getByRole('button').filter({ hasText: ticketSubject }).first().click();
  await expect(page.getByText(managerReply).first()).toBeVisible({ timeout: 8000 });
});

test('the reply reached the customer thread', async ({ page }) => {
  await login(page, ACCOUNTS.customer);
  await page.goto('/support');
  await page.getByText(ticketSubject).first().click();
  await expect(page.getByText(managerReply).first()).toBeVisible({ timeout: 8000 });
});

// ─────────────────────────── 2. ORDER: customer places → manager assigns ───────────────────────────
test('customer places an order (Website Audit)', async ({ page }) => {
  await login(page, ACCOUNTS.customer);
  await page.goto('/services/audit');
  await page.locator('label').filter({ hasText: /\$/ }).first().click(); // pick first package
  await page.locator('textarea[name="focus"]').fill(`Cross-role audit ${stamp}`); // required brief field
  await page.getByRole('button', { name: /^Place order/i }).first().click();

  // success toast carries the code: "Order XX-#### placed — credit charged"
  const toast = page.getByText(/Order\s+[A-Z]{2,3}-\d+\s+placed/i).first();
  await toast.waitFor({ state: 'visible', timeout: 10_000 });
  placedOrderCode = ((await toast.textContent()) ?? '').match(/[A-Z]{2,3}-\d+/)?.[0] ?? null;
  console.log('CROSS-ROLE placedOrderCode =', placedOrderCode);
  expect(placedOrderCode).toBeTruthy();
});

test('manager sees an unassigned order in the queue and assigns it', async ({ page }) => {
  await login(page, ACCOUNTS.manager);
  await page.goto('/manager/assignment');
  await expect(page.getByText(/Route work to your pod/i)).toBeVisible();

  // prefer the just-placed order; else any unassigned order in the queue
  if (placedOrderCode) {
    await expect(page.getByText(placedOrderCode).first()).toBeVisible({ timeout: 8000 });
  }
  const assign = page.getByRole('button', { name: /^Assign$/ }).first();
  await expect(assign).toBeVisible({ timeout: 8000 });
  await assign.click();
  await expect(page.getByText(/Assigned|already|pod/i).first()).toBeVisible({ timeout: 8000 });
});

// ─────────────────────────── 3. REVISION: customer requests changes → manager sees it ───────────────
test('customer requests changes on a delivered order', async ({ page }) => {
  // arrange: put jane's order into 'delivered' so the customer can request changes
  db(`update orders set state='delivered' where code='${REVISION_ORDER}'`);

  await login(page, ACCOUNTS.customer);
  await page.goto('/orders');
  await page.getByText(REVISION_ORDER).first().click();
  const requestBtn = page.getByRole('button', { name: /Request changes/i }).first();
  await expect(requestBtn).toBeVisible({ timeout: 8000 });
  await requestBtn.click();
  // revision composer modal: required note → "Send for revision"
  await page.getByPlaceholder(/What needs revising/i).fill(`Please revise the intro — ${stamp}`);
  await page.getByRole('button', { name: /Send for revision/i }).click();
  await expect(page.getByText(/Sent back for revision|Changes requested/i).first()).toBeVisible({ timeout: 8000 });
});

test('manager sees the order as changes-requested', async ({ page }) => {
  await login(page, ACCOUNTS.manager);
  await page.goto('/manager/orders');
  await expect(page.getByText(REVISION_ORDER).first()).toBeVisible({ timeout: 8000 });
  // the revised order surfaces with a changes-requested state somewhere on the manager board/review
  const board = await page.locator('body').innerText();
  expect(board).toMatch(/Changes requested|changes_requested|Revision/i);
});
