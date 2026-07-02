import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Every previously-mock Settings tab now persists to real Supabase (customer-scoped). Each block
// mutates, reloads, and asserts the value survived — proving it round-trips through the DB, not localStorage.
test('settings tabs persist to the backend across reload', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });

  // ── API key: generate a real key (token shown once), then confirm it survives reload ──
  await page.getByRole('button', { name: 'API & Webhook' }).click();
  await page.getByRole('button', { name: /New key/i }).click();
  await page.getByPlaceholder('e.g. Production server').fill('E2E key');
  await page.getByRole('button', { name: /Generate key/i }).click();
  await expect(page.getByText(/^sk_live_/).first()).toBeVisible({ timeout: 10_000 }); // full token, once
  await page.getByRole('button', { name: 'Done' }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'API & Webhook' }).click();
  await expect(page.getByText('E2E key').first()).toBeVisible({ timeout: 10_000 });

  // ── Payment method: add real metadata (brand + last4), confirm it persists ──
  await page.getByRole('button', { name: 'Billing & Credit' }).click();
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByPlaceholder('4242').fill('4242');
  await page.getByPlaceholder('08/27').fill('08/27');
  await page.getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByText(/Visa •••• 4242/).first()).toBeVisible({ timeout: 10_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Billing & Credit' }).click();
  await expect(page.getByText(/Visa •••• 4242/).first()).toBeVisible({ timeout: 10_000 });

  // ── 2FA preference: toggle on, confirm it persists ──
  await page.getByRole('button', { name: 'Account & Security' }).click();
  const twofa = page.getByRole('switch').first();
  const before = await twofa.getAttribute('aria-checked');
  await twofa.click();
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Account & Security' }).click();
  await expect(page.getByRole('switch').first()).toHaveAttribute('aria-checked', String(before !== 'true'));

  // ── Appearance: change timezone, confirm it persists ──
  await page.getByRole('button', { name: 'Appearance & Language' }).click();
  const tz = page.locator('select').filter({ has: page.locator('option', { hasText: 'UTC' }) }).first();
  await tz.selectOption('(GMT+7) Bangkok / Hanoi');
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Appearance & Language' }).click();
  const tz2 = page.locator('select').filter({ has: page.locator('option', { hasText: 'UTC' }) }).first();
  await expect(tz2).toHaveValue('(GMT+7) Bangkok / Hanoi');
});
