import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { login, ACCOUNTS } from './helpers';

// Fetch one of Mai's assignable order ids (state has a staff action) so the transition test is deterministic.
function actionableTaskId(): string | null {
  const out = execSync(
    `npx supabase db query ${JSON.stringify(
      "select o.id from orders o join profiles p on p.id=o.assignee_id where p.email='mai@hevaseo.com' and o.state in ('assigned','in_progress','changes_requested') limit 1",
    )}`,
    { cwd: process.cwd().replace(/\/apps\/app$/, ''), encoding: 'utf8' },
  );
  return out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0] ?? null;
}

// Deeper per-feature checks for the staff surface (Mai T.). Each test logs in fresh and drives one
// feature. Resilient: interacts only when rows exist.
test.beforeEach(async ({ page }) => {
  await login(page, ACCOUNTS.staff);
});

async function bodyText(page: Page) {
  return page.locator('body').innerText();
}

test('My Day · greeting + focus content renders', async ({ page }) => {
  await page.goto('/staff');
  await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible();
  await expect(page.getByText(/focus|today|up next|due|task|deliver/i).first()).toBeVisible();
});

test('Tasks · board card opens a price-free quick-view panel', async ({ page }) => {
  await page.goto('/staff/tasks');
  await expect(page.getByRole('heading', { name: /My Tasks/i }).first()).toBeVisible();
  // board cards are native <button> elements — open the first one's quick-view SlideOver
  const card = page.getByRole('button').filter({ hasText: /[A-Z]{2,3}-\d+/ }).first();
  await expect(card).toBeVisible();
  await card.click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link', { name: /Open full task/i })).toBeVisible();
  // staff must NOT see the customer price/order value (money-blind via orders_mgr)
  expect(await panel.innerText(), 'staff task panel leaked a customer price').not.toMatch(/\$\s?\d{2,}/);
});

test('Tasks · staff advances a task (real advance_order transition)', async ({ page }) => {
  const id = actionableTaskId();
  test.skip(!id, 'no assignable task in a startable state');
  await page.goto(`/staff/tasks/${id}`);
  // primary next-stage action for the task's current state (Start / Submit for review / Resume)
  const action = page.getByRole('button', { name: /^(Start|Submit for review|Resume)$/ }).first();
  await expect(action).toBeVisible({ timeout: 8000 });
  await action.click();
  // optimistic flash "CODE → Label" (or "Moved to …") proves advance_order succeeded, no auth error
  await expect(page.getByText(/→|Moved to|Submitted for review/i).first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/not authorized|forbidden|only an? (admin|manager)/i)).toHaveCount(0);
});

test('Calendar · deadlines render', async ({ page }) => {
  await page.goto('/staff/calendar');
  await expect(page.getByText(/laid out by day/i)).toBeVisible();
  await expect(page.getByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun|today|due|no deadlines/i).first()).toBeVisible();
});

test('Deliverables · surface renders', async ({ page }) => {
  await page.goto('/staff/deliverables');
  await expect(page.getByRole('heading', { name: 'Deliverables' }).first()).toBeVisible();
  await expect(page.getByText(/upload|submit|awaiting|approved|deliver|no deliver|attach/i).first()).toBeVisible();
});

test('Inbox · broadcasts render', async ({ page }) => {
  await page.goto('/staff/inbox');
  await expect(page.getByRole('heading', { name: 'Inbox' }).first()).toBeVisible();
  await expect(page.getByText(/message|broadcast|no messages|all caught|from|unread/i).first()).toBeVisible();
});

test('Docs · list renders and a doc opens in-area', async ({ page }) => {
  await page.goto('/staff/docs');
  await expect(page.getByText(/published for your specialty/i)).toBeVisible();
  const doc = page.locator('a[href*="/staff/docs/"]').first();
  if (await doc.count()) {
    const href = await doc.getAttribute('href');
    expect(href).toMatch(/^\/staff\/docs\//);
    await doc.click();
    await page.waitForURL(/\/staff\/docs\/[^/]+$/, { timeout: 8000 });
    await expect(page.locator('article, main').first()).toBeVisible();
  }
});

test('Notes · create a note and see it persist', async ({ page }) => {
  await page.goto('/staff/notes');
  await expect(page.getByText(/private notebook/i)).toBeVisible();

  const title = `Staff QA note ${Date.now()}`;
  await page.getByRole('button', { name: /New note/i }).first().click();
  await page.getByPlaceholder('Note title').fill(title);
  await page.getByRole('button', { name: /Create note/i }).click();

  await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
  await page.reload();
  await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
});

test('Finance · own wallet renders (money allowed) + payout control', async ({ page }) => {
  await page.goto('/staff/finance');
  await expect(page.getByText(/your pay only/i)).toBeVisible();
  await expect(page.getByText(/wallet|balance|available|commission|payout/i).first()).toBeVisible();
  // this is the staffer's OWN money → a figure should render
  expect(await bodyText(page)).toMatch(/\$\s?\d/);
  await expect(page.getByRole('button', { name: /payout|withdraw/i }).first()).toBeVisible();
});

test('Performance · scorecard renders', async ({ page }) => {
  await page.goto('/staff/performance');
  await expect(page.getByText(/My standing/i)).toBeVisible();
  await expect(page.getByText(/score|rank|on-time|quality|earnings|streak|reviews/i).first()).toBeVisible();
});

test('Notifications · list renders', async ({ page }) => {
  await page.goto('/staff/notifications');
  await expect(page.getByText(/Assignments, reviews/i)).toBeVisible();
  await expect(page.getByText(/assigned|review|reminder|bonus|no notifications|caught up/i).first()).toBeVisible();
});

test('Settings · profile & availability render', async ({ page }) => {
  await page.goto('/staff/settings');
  await expect(page.getByText(/profile, availability/i)).toBeVisible();
  await expect(page.getByText(/profile|availability|status|name|email|notification/i).first()).toBeVisible();
});
