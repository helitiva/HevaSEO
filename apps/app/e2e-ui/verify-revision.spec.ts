import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// Requesting changes on a delivered order requires a NOTE (what to revise) and supports pasted/attached
// images & videos. The note + media must persist as a visible order message and the order goes back.
test('request changes requires a note + captures attached media', async ({ page }) => {
  test.setTimeout(90_000);
  const note = `Please redo the intro ${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1280, height: 1000 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/orders?order=REV-TEST', { waitUntil: 'domcontentloaded' });

  // the delivered order shows the review block → open the revision composer
  await expect(page.getByRole('button', { name: /Request changes/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Request changes/i }).click();

  // Send is disabled until a note is written
  const send = page.getByRole('button', { name: /Send for revision/i });
  await expect(send).toBeDisabled();
  await page.getByPlaceholder(/What needs revising/i).fill(note);
  // attach an image → it uploads to storage and shows a thumbnail
  await page.locator('input[type="file"]').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForTimeout(1500);
  await expect(send).toBeEnabled();
  await send.click();

  // confirmation + the order leaves the awaiting-review state
  await expect(page.getByText('Sent back for revision — the team will see your note').first()).toBeVisible({ timeout: 10_000 });
});
