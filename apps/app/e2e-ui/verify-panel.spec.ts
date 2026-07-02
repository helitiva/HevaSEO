import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

const SHOTS = process.env.SHOTS || '/private/tmp/claude-501/-Users-huy-Desktop-Projects-Web2-hevaseo-platform/ee2814f6-f9ed-4c8c-9e62-d099dfc8570d/scratchpad/demo-shots';

// Phase E: the customer order panel is now real — real brief, read-only status, and a real, persistent
// message thread (order_messages). Needs the seeded DEMO-501 delivered order + brief.
test('customer panel: real brief, read-only status, persistent comment', async ({ page }) => {
  const note = `QA note ${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1280, height: 950 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/orders?order=DEMO-501', { waitUntil: 'domcontentloaded' });

  // real brief (from order_details) + delivered-review actions
  await expect(page.getByText(/Order brief/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Known issues')).toBeVisible();
  await expect(page.getByRole('button', { name: /Approve delivery/i })).toBeVisible();
  // status is read-only for real orders (no status dropdown/combobox inside the panel)
  const panel = page.locator('aside').filter({ hasText: 'DEMO-501' });
  await expect(panel.getByRole('combobox')).toHaveCount(0);

  // post a real comment → appears in the thread
  await page.getByPlaceholder('Add a comment…').fill(note);
  await page.getByRole('button', { name: /Send comment/i }).click();
  await expect(page.getByText(note).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${SHOTS}/verify_panel_comment.png` });

  // RELOAD → the comment persisted (real order_messages, not client state)
  await page.goto('/orders?order=DEMO-501', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(note).first()).toBeVisible({ timeout: 10_000 });
});
