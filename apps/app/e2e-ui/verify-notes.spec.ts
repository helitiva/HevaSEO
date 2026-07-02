import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Notes are now DB-backed (owner-scoped): a customer's note persists across a reload (was localStorage).
test('customer note persists to the backend', async ({ page }) => {
  const title = `QA note ${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/notes', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /New note/i }).first().click();
  await page.getByPlaceholder('Note title').fill(title);
  await page.getByRole('button', { name: /Create note/i }).click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });

  // RELOAD → the note survived (real DB, not localStorage)
  await page.goto('/notes', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
});
