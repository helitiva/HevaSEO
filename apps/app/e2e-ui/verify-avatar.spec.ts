import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Avatar/logo upload: a real file goes to the Storage 'avatars' bucket, the public URL is persisted to
// customers.avatar_url, and the image survives a reload (proving it round-trips through Storage + DB).
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test('profile photo uploads to storage and persists', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 950 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });

  await page.locator('input[type="file"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG_1x1 });
  await expect(page.getByAltText('Profile photo')).toBeVisible({ timeout: 15_000 });
  const src = await page.getByAltText('Profile photo').getAttribute('src');
  expect(src ?? '').toContain('/storage/v1/object/public/avatars/');

  // persists across reload (URL was saved to the DB, not just local state)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByAltText('Profile photo')).toBeVisible({ timeout: 15_000 });

  // Remove clears it back to initials
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByAltText('Profile photo')).toHaveCount(0, { timeout: 10_000 });
});
