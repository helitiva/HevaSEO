import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// The Support form's "Related service" / "Related project" must be the customer's REAL orders/projects
// (not mock), and picking an order links the ticket to it (tickets.order_id → shown as an #ORDER chip).
test('support form uses real orders/projects and links the ticket to the chosen order', async ({ page }) => {
  test.setTimeout(60_000);
  const subject = `Order help ${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1280, height: 1000 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/support', { waitUntil: 'domcontentloaded' });

  // "Related service" select = real orders, no mock codes
  const svcSel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Not service-related' }) }).first();
  const opts = await svcSel.evaluate((s: HTMLSelectElement) => Array.from(s.options).map((o) => ({ v: o.value, t: (o.textContent ?? '').trim() })));
  expect(opts.some((o) => o.t.includes('BLEN-1042'))).toBe(false);            // mock gone
  const realOrder = opts.find((o) => o.v !== '__none');
  expect(realOrder).toBeTruthy();                                            // at least one real order
  expect(realOrder!.t).toContain(`#${realOrder!.v}`);                        // option label carries the real code

  // create a ticket linked to that order
  await svcSel.selectOption(realOrder!.v);
  await page.getByPlaceholder('e.g. Links not indexed after 5 days').fill(subject);
  await page.getByRole('button', { name: /Submit ticket/i }).click();
  await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10_000 });
  // the linked order code shows as a chip on the ticket row
  await expect(page.locator('tr', { hasText: subject }).getByText(`#${realOrder!.v}`)).toBeVisible({ timeout: 10_000 });
});
