import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Hovering a staff/manager avatar on an order card reveals a card with full name, title and duty.
test('order card person hover card shows name, title, duty', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1500, height: 950 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/orders', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  // find a person tag whose hover card is a real (non-Unassigned) person
  const tag = page.locator('.kcard .group\\/person').filter({ hasNot: page.getByText('Unassigned') }).first();
  await tag.scrollIntoViewIfNeeded();
  const tip = tag.locator('[role="tooltip"]');
  await expect(tip).toHaveCount(1);
  // hidden until hover
  expect(await tip.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
  await tag.hover();
  await page.waitForTimeout(300);
  expect(Number(await tip.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.5);
  // it carries a title/duty line (role text)
  await expect(tip).toContainText(/Specialist|Writer|Auditor|Strategist|Designer|Account Manager/);
});

// An archived project must not appear in the order form's Project picker.
test('archived project is absent from the order-form project picker', async ({ page }) => {
  test.setTimeout(90_000);
  const tag = Date.now().toString(36);
  const domain = `arch-pick-${tag}.com`;
  await page.setViewportSize({ width: 1280, height: 950 });
  await login(page, ACCOUNTS.customer);

  // create a project, then archive it
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByPlaceholder('example.com').fill(domain);
  await page.getByRole('button', { name: /Create project/i }).click();
  const card = page.locator('.pcard').filter({ hasText: domain });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByRole('button', { name: /Project settings/i }).click();
  await page.getByRole('button', { name: 'Move to Archive', exact: true }).click();
  await expect(page.locator('.pcard').filter({ hasText: domain })).toHaveCount(0, { timeout: 10_000 });

  // the order form's project <select> must NOT list the archived project
  await page.goto('/services/backlink', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const opts = await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll('select'));
    const projSel = sels.find((s) => Array.from(s.options).some((o) => /New project/i.test(o.textContent ?? '')));
    return projSel ? Array.from(projSel.options).map((o) => (o.textContent ?? '').trim()) : [];
  });
  expect(opts.some((o) => o.includes(domain))).toBe(false);
});
