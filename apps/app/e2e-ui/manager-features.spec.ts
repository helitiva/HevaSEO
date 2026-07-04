import { test, expect, type Page } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Deeper per-feature interaction checks for the manager surface. Each test logs in fresh as the pod
// manager (Sofia) and drives one feature end-to-end. Kept resilient: where a list may be empty the test
// asserts the surface renders and only interacts when rows exist.
test.beforeEach(async ({ page }) => {
  await login(page, ACCOUNTS.manager);
});

const CURRENCY = /\$\s?\d[\d,]*/;
async function bodyText(page: Page) {
  return (await page.locator('body').innerText());
}

test('Overview · command center renders pod signals', async ({ page }) => {
  await page.goto('/manager');
  await expect(page.getByRole('heading', { name: /pod/i }).first()).toBeVisible();
  // action-first command center: a triage/queue or scorecard section is present
  await expect(page.getByText(/triage|queue|needs you|attention|scorecard|utilization|throughput/i).first()).toBeVisible();
  expect(await bodyText(page)).not.toMatch(CURRENCY);
});

test('Orders · kanban renders and an order opens a real (money-blind) detail', async ({ page }) => {
  await page.goto('/manager/orders');
  await expect(page.getByRole('heading', { name: 'Orders' }).first()).toBeVisible();
  expect(await bodyText(page)).not.toMatch(CURRENCY);

  // open the first order card by its code and confirm a real detail panel (not blank)
  const code = page.getByRole('button', { name: /^[A-Z]{2,3}-\d+$/ }).first();
  if (await code.count()) {
    await code.click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/load this order/i)).toHaveCount(0);
    await expect(panel.getByText(/Scope|Brief|Timeline|Customer|Project/i).first()).toBeVisible();
  }
});

test('Assignment · manager picks a pod staffer and assigns', async ({ page }) => {
  await page.goto('/manager/assignment');
  await expect(page.getByText(/Route work to your pod/i)).toBeVisible();
  // roster populated → utilization is a real % (not NaN)
  await expect(page.getByText(/NaN/)).toHaveCount(0);
  await expect(page.getByText('Mai T.').first()).toBeVisible();
  const assign = page.getByRole('button', { name: /^Assign$/ }).first();
  if (await assign.count()) {
    await assign.click();
    await expect(page.getByText(/Assigned|already|pod/i).first()).toBeVisible({ timeout: 8000 });
  }
});

test('Review · QA queue renders', async ({ page }) => {
  await page.goto('/manager/review');
  await expect(page.getByText(/Deliverables awaiting QA/i)).toBeVisible();
  // a queue/stat surface renders (approve/reject controls or an empty state)
  await expect(page.getByText(/approve|reject|awaiting|clear|caught up|queue|pending/i).first()).toBeVisible();
  expect(await bodyText(page)).not.toMatch(CURRENCY);
});

test('Tickets · list renders and a ticket opens its detail', async ({ page }) => {
  await page.goto('/manager/tickets');
  await expect(page.getByText(/tickets in your pod/i)).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: /TKT-|#\d|open|resolved|pending/i }).first();
  const anyRow = (await row.count()) ? row : page.locator('tbody tr, [role="row"]').first();
  if (await anyRow.count()) {
    await anyRow.click();
    // 2-pane helpdesk dialog opens
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 6000 });
  }
});

test('Inbox · broadcasts render', async ({ page }) => {
  await page.goto('/manager/inbox');
  await expect(page.getByRole('heading', { name: 'Inbox' }).first()).toBeVisible();
  await expect(page.getByText(/message|broadcast|no messages|all caught|from|unread/i).first()).toBeVisible();
});

test('Performance · KPIs render', async ({ page }) => {
  await page.goto('/manager/performance');
  await expect(page.getByRole('heading', { name: /My performance/i }).first()).toBeVisible();
  await expect(page.getByText(/on-time|quality|throughput|score|SLA|utilization|reviews/i).first()).toBeVisible();
});

test('Finance · own pay/wallet renders (money allowed)', async ({ page }) => {
  await page.goto('/manager/finance');
  await expect(page.getByText(/salary/i).first()).toBeVisible();
  await expect(page.getByText(/payout|commission|wallet|balance|available/i).first()).toBeVisible();
  // this is the manager's OWN money → it should actually render a figure
  expect(await bodyText(page)).toMatch(CURRENCY);
});

test('Customers · list renders, row panel opens, full profile is in-area + money-blind', async ({ page }) => {
  await page.goto('/manager/customers');
  await expect(page.getByRole('heading', { name: 'Customers' }).first()).toBeVisible();
  expect(await bodyText(page)).not.toMatch(CURRENCY);

  // clicking a row opens a slide-over panel (not a navigation)
  await page.locator('[role="button"][aria-label^="Open "]').first().click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  // the panel must NOT expose customer impersonation to a money-blind manager
  await expect(panel.getByRole('button', { name: /Impersonate/i })).toHaveCount(0);
  // "Open full profile" must stay inside /manager (regression: it pointed at /admin → dead link)
  const href = await panel.getByRole('link', { name: /Open full profile/i }).getAttribute('href');
  expect(href).toMatch(/^\/manager\/customers\//);

  // and the detail route itself renders money-blind
  await page.goto(href!);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText(/Total orders|Projects|Contact|Orders/i).first()).toBeVisible();
  expect(await bodyText(page)).not.toMatch(CURRENCY);
});

test('Staff · list renders, detail opens, view-as (view-only) present', async ({ page }) => {
  await page.goto('/manager/staff');
  await expect(page.getByText(/My staff/i)).toBeVisible();
  expect(await bodyText(page)).not.toMatch(CURRENCY);
  const staffLink = page.locator('a[href*="/manager/staff/"]').first();
  if (await staffLink.count()) {
    await staffLink.click();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toMatch(/\/manager\/staff\//);
    // manager impersonation is view-only → "View as", never the acting "Impersonate"
    await expect(page.getByRole('button', { name: /View as/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Impersonate$/ })).toHaveCount(0);
  }
});

test('Docs · list renders and a doc opens (in-area)', async ({ page }) => {
  await page.goto('/manager/docs');
  await expect(page.getByText(/published for managers/i)).toBeVisible();
  const doc = page.locator('a[href*="/manager/docs/"]').first();
  if (await doc.count()) {
    const href = await doc.getAttribute('href');
    expect(href).toMatch(/^\/manager\/docs\//); // area-aware base
    await doc.click();
    await page.waitForURL(/\/manager\/docs\/[^/]+$/, { timeout: 8000 });
    await expect(page.locator('article, main').first()).toBeVisible();
  }
});

test('Notes · create a note and see it in the list', async ({ page }) => {
  await page.goto('/manager/notes');
  await expect(page.getByText(/private notebook/i)).toBeVisible();

  const title = `Mgr QA note ${Date.now()}`;
  await page.getByRole('button', { name: /New note/i }).first().click(); // opens an inline composer modal
  await page.getByPlaceholder('Note title').fill(title);
  await page.getByRole('button', { name: /Create note/i }).click();

  // modal closes → the new note appears in the list (persisted to the DB)
  await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
  await page.reload();
  await expect(page.getByText(title)).toBeVisible({ timeout: 8000 }); // survives reload = persisted
});

test('Audit · log renders', async ({ page }) => {
  await page.goto('/manager/audit');
  await expect(page.getByText(/Audit log/i).first()).toBeVisible();
  await expect(page.getByText(/assigned|created|updated|delivered|no activity|order|ticket/i).first()).toBeVisible();
});

test('Settings · profile & prefs render', async ({ page }) => {
  await page.goto('/manager/settings');
  await expect(page.getByText(/notification preferences/i)).toBeVisible();
  await expect(page.getByText(/profile|email|name|notification/i).first()).toBeVisible();
});
