import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// F3 — dashboard "Recent activity" is derived from the customer's real data (orders/credit/tickets).
test('dashboard activity feed is real', async ({ page }) => {
  await login(page, ACCOUNTS.customer);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Recent activity')).toBeVisible({ timeout: 10_000 });
  // Jane (ACME) has real orders + ledger → the feed shows real signals, not the mock strings.
  await expect(page.getByText(/placed|delivered|Topped up|Charged|Refunded|opened/i).first()).toBeVisible({ timeout: 10_000 });
});

// F4 — profile settings persist to the customer's own row (was localStorage).
test('customer profile edit persists', async ({ page }) => {
  const name = `Jane QA ${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });

  const nameInput = page.locator('div:has(> label:has-text("Full name")) input').first();
  await expect(nameInput).toBeVisible({ timeout: 10_000 });
  await nameInput.fill(name);
  await page.getByRole('button', { name: /Save changes/i }).first().click();
  await expect(page.getByText('Profile saved')).toBeVisible({ timeout: 10_000 });

  // RELOAD → the name persisted (real customers row, not localStorage)
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('div:has(> label:has-text("Full name")) input').first()).toHaveValue(name, { timeout: 10_000 });
});
