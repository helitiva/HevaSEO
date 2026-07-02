import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

const SHOTS = process.env.SHOTS || '/private/tmp/claude-501/-Users-huy-Desktop-Projects-Web2-hevaseo-platform/ee2814f6-f9ed-4c8c-9e62-d099dfc8570d/scratchpad/demo-shots';

// Tickets + chat are now real: a customer opens a ticket, chats, and it persists (was mock seed).
test('customer opens a ticket + replies, persisted', async ({ page }) => {
  const subject = `QA ticket ${Date.now().toString(36)}`;
  const reply = 'Any update on this?';
  await page.setViewportSize({ width: 1280, height: 950 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/support', { waitUntil: 'domcontentloaded' });

  // open a ticket
  await page.getByPlaceholder('e.g. Links not indexed after 5 days').fill(subject);
  await page.getByRole('button', { name: /Submit ticket/i }).click();
  await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 }); // appears in "Your tickets"

  // open the thread + post a reply
  await page.getByText(subject).first().click();
  await expect(page.getByText('Please take a look.').first().or(page.getByText(subject).first())).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder('Write a reply…').fill(reply);
  await page.getByRole('button', { name: /Send reply/i }).click();
  await expect(page.getByText(reply).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${SHOTS}/verify_support_thread.png` });

  // RELOAD → the ticket persisted (real tickets table, not mock seed)
  await page.goto('/support', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
});
