import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// G1 — the full 2-way ticket loop: customer opens a ticket, admin sees + replies, customer sees the reply.
test('admin replies to a customer ticket (2-way)', async ({ browser }) => {
  test.setTimeout(120_000);
  const tag = `2way-${Date.now().toString(36)}`;
  const subject = `Help ${tag}`;
  const reply = `We are on it ${tag}`;

  const cCtx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const cust = await cCtx.newPage();
  await login(cust, ACCOUNTS.customer);
  await cust.goto('/support', { waitUntil: 'domcontentloaded' });
  await cust.getByPlaceholder('e.g. Links not indexed after 5 days').fill(subject);
  await cust.getByRole('button', { name: /Submit ticket/i }).click();
  await expect(cust.getByText(subject).first()).toBeVisible({ timeout: 10_000 });

  // admin sees the real ticket + replies
  const aCtx = await browser.newContext({ viewport: { width: 1560, height: 950 } });
  const admin = await aCtx.newPage();
  await login(admin, ACCOUNTS.admin);
  await admin.goto('/admin/tickets', { waitUntil: 'domcontentloaded' });
  await admin.getByPlaceholder('Search subject, code, customer…').fill(tag);
  await admin.getByText(subject).first().click();
  const composer = admin.getByPlaceholder(/Reply to/i);
  await expect(composer).toBeVisible({ timeout: 10_000 });
  await composer.fill(reply);
  await admin.getByRole('button', { name: /Send reply/i }).click();
  await expect(admin.getByText(reply).first()).toBeVisible({ timeout: 10_000 });
  await aCtx.close();

  // customer sees the admin reply in their thread
  const c2 = await cCtx.newPage();
  await c2.goto('/support', { waitUntil: 'domcontentloaded' });
  await c2.getByText(subject).first().click();
  await expect(c2.getByText(reply).first()).toBeVisible({ timeout: 10_000 });
  await cCtx.close();
});

// G3 — the "Live chat" widget is backed by a real ticket.
test('live chat creates a real ticket', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/support', { waitUntil: 'domcontentloaded' });
  await page.getByText('Open chat').first().click();
  await page.getByPlaceholder(/^Message /).fill('Hi, quick question about my campaign');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.goto('/support', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Live chat with your specialist').first()).toBeVisible({ timeout: 10_000 });
});

// G2 — kanban cards carry a solid status accent (left border) so they read colored at any state.
test('kanban card has a status accent border', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/orders', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const border = await page.evaluate(() => {
    const card = document.querySelector('.kcard.onav') as HTMLElement | null;
    return card ? getComputedStyle(card).borderLeftWidth : null;
  });
  expect(border).toBe('3px');
});
