import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// End-to-end support ticket: customer opens (subject + description + Billing + Urgent) → the description
// reaches the ADMIN → admin replies → the reply reaches the customer → customer closes it.
test('support ticket full 2-way lifecycle', async ({ browser }) => {
  test.setTimeout(120_000);
  const tag = Date.now().toString(36);
  const subject = `Help ${tag}`;
  const desc = `Detailed issue ${tag}: my backlinks are not indexed.`;
  const custReply = `Customer follow-up ${tag}`;
  const adminReply = `Admin answer ${tag}`;

  // ── customer opens the ticket ──
  const cCtx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const cust = await cCtx.newPage();
  await login(cust, ACCOUNTS.customer);
  await cust.goto('/support', { waitUntil: 'domcontentloaded' });
  await cust.locator('select').filter({ has: cust.locator('option', { hasText: 'Billing & Credit' }) }).selectOption({ label: 'Billing & Credit' });
  await cust.getByPlaceholder('e.g. Links not indexed after 5 days').fill(subject);
  await cust.getByPlaceholder(/Describe the issue/i).fill(desc);
  await cust.getByRole('button', { name: 'Urgent' }).click();
  await cust.getByRole('button', { name: /Submit ticket/i }).click();
  await expect(cust.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
  // open it → the description is the first thread message
  await cust.getByText(subject).first().click();
  await expect(cust.getByText(desc).first()).toBeVisible({ timeout: 10_000 });
  await cust.getByPlaceholder(/Write a reply/i).fill(custReply);
  await cust.getByRole('button', { name: 'Send reply' }).click();
  await expect(cust.getByText(custReply).first()).toBeVisible({ timeout: 10_000 });
  await cust.keyboard.press('Escape');

  // ── admin sees the ticket WITH the description + customer reply, and answers ──
  const aCtx = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
  const admin = await aCtx.newPage();
  await login(admin, ACCOUNTS.admin);
  await admin.goto('/admin/tickets', { waitUntil: 'domcontentloaded' });
  await admin.getByPlaceholder('Search subject, code, customer…').fill(tag);
  await admin.getByText(subject).first().click();
  await expect(admin.getByText(desc).first()).toBeVisible({ timeout: 10_000 });     // description flowed through
  await expect(admin.getByText(custReply).first()).toBeVisible({ timeout: 10_000 }); // customer reply too
  const composer = admin.getByPlaceholder(/Reply to/i);
  await composer.fill(adminReply);
  await admin.getByRole('button', { name: /Send reply/i }).click();
  await expect(admin.getByText(adminReply).first()).toBeVisible({ timeout: 10_000 });
  await aCtx.close();

  // ── customer sees the admin reply, then closes the ticket ──
  const c2 = await cCtx.newPage();
  await c2.goto('/support', { waitUntil: 'domcontentloaded' });
  await c2.getByText(subject).first().click();
  await expect(c2.getByText(adminReply).first()).toBeVisible({ timeout: 10_000 });
  await c2.getByRole('button', { name: 'Close ticket' }).click();
  await expect(c2.getByText('Ticket closed').first()).toBeVisible({ timeout: 10_000 });
  await cCtx.close();
});
