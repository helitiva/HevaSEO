import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

const SHOTS = process.env.SHOTS || '/private/tmp/claude-501/-Users-huy-Desktop-Projects-Web2-hevaseo-platform/ee2814f6-f9ed-4c8c-9e62-d099dfc8570d/scratchpad/demo-shots';

test('customer delivered-review — single-line rows + order-detail sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/orders', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Ready for your review')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/strip_01_rows.png` });

  // clicking a row opens the slide-over order detail (delivered work + approve/send-back)
  await page.getByText('DEMO-501').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Approve delivery/i })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/strip_02_sidebar.png` });
});
