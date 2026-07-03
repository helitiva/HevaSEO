import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGAwClWQMS9tR4nQAAAABJRU5ErkJggg==', 'base64');

// The 2-pane ticket dialog: details rail (status/priority/agent/order), reply with an image, and the
// resolve → CSAT rating flow.
test('ticket detail dialog: reply w/ media, resolve, and rate', async ({ page }) => {
  test.setTimeout(90_000);
  const subject = `Detail ${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1400, height: 1000 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/support', { waitUntil: 'domcontentloaded' });

  // create + open a ticket
  await page.getByRole('button', { name: 'Urgent' }).click();
  await page.getByPlaceholder('e.g. Links not indexed after 5 days').fill(subject);
  await page.getByRole('button', { name: /Submit ticket/i }).click();
  await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
  await page.getByText(subject).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  // details rail is present
  await expect(dialog.getByText('Awaiting assignment')).toBeVisible();       // agent
  await expect(dialog.getByText('Opened')).toBeVisible();                    // created row
  await expect(dialog.getByText('Urgent').first()).toBeVisible();            // priority chip

  // reply with an image attachment
  await dialog.getByPlaceholder(/Write a reply/i).fill('Here is a screenshot');
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForTimeout(1500);
  await dialog.getByRole('button', { name: 'Send reply' }).click();
  await expect(dialog.getByText('Here is a screenshot')).toBeVisible({ timeout: 10_000 });
  await expect(dialog.locator('img').first()).toBeVisible();                 // the attachment renders

  // resolve → CSAT appears → rate
  await dialog.getByRole('button', { name: /Mark resolved/i }).click();
  await expect(dialog.getByText('How was the support?')).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: '5 star' }).click();
  await dialog.getByRole('button', { name: 'Submit rating' }).click();
  await expect(dialog.getByText('Your rating')).toBeVisible({ timeout: 10_000 });
});
