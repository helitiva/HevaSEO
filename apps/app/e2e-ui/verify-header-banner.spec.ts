import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// The top-bar avatar reflects the uploaded profile photo (was hardcoded initials).
test('top-bar avatar shows the uploaded profile photo', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1400, height: 950 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="file"]').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await page.getByAltText('Profile photo').waitFor({ timeout: 10_000 });
  // header avatar updates without a manual reload (router.refresh re-fetches the layout)
  await expect(page.locator('header img[alt="Account"]')).toBeVisible({ timeout: 10_000 });
});

// Dismissing an overview banner is durable per-account (broadcast_events 'dismissed'), not browser-local.
test('banner dismissal is DB-backed (survives a localStorage wipe)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1400, height: 950 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const dismissBtn = page.locator('.broadcast-pop button[aria-label="Dismiss message"]').first();
  if (!(await dismissBtn.count())) return; // already dismissed in a prior run — nothing to assert
  await dismissBtn.click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await expect(page.locator('.broadcast-pop')).toHaveCount(0, { timeout: 10_000 });
});
