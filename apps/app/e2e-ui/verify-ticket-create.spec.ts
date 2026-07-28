import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Creating a ticket must capture the detailed DESCRIPTION (was dropped — body used the subject) and
// persist; the opened thread shows the real description, and it survives a reload.
test('support ticket captures the description + persists', async ({ page }) => {
  test.setTimeout(60_000);
  const tag = Date.now().toString(36);
  const subject = `TK ${tag}`;
  const desc = `Detailed problem ${tag}: my links are not indexed after 5 days.`;
  await page.setViewportSize({ width: 1280, height: 1000 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/support', { waitUntil: 'domcontentloaded' });

  await page.getByPlaceholder('e.g. Links not indexed after 5 days').fill(subject);
  await page.getByPlaceholder(/Describe the issue/i).fill(desc);
  await page.getByRole('button', { name: 'Urgent' }).click();
  await page.getByRole('button', { name: /Submit ticket/i }).click();

  // ticket shows in the list, then open it → the thread carries the real description (not the subject)
  await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
  await page.getByText(subject).first().click();
  await expect(page.getByText(desc).first()).toBeVisible({ timeout: 10_000 });

  // persists across reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
});
