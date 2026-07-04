import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Regression: clicking an order in the Assignment queue opened a BLANK slide-over. The panel built its
// props from the mock client-side (buildOrderDetailProps by id), but queue orders are real UUIDs → null
// → blank. Now it fetches the real order RLS-scoped. Manager stays money-blind but must see the order.
test('manager: assignment order panel shows real detail (not blank)', async ({ page }) => {
  await login(page, ACCOUNTS.manager);
  await page.goto('http://localhost:4500/manager/assignment');

  // open the first order in the queue by its code button
  const firstCode = page.getByRole('button', { name: /^[A-Z]{2,3}-\d+$/ }).first();
  await expect(firstCode).toBeVisible();
  const code = (await firstCode.textContent())?.trim() ?? '';
  await firstCode.click();

  // slide-over opens with the order code as its title, and real detail content (not the loader/fallback)
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(code, { exact: false }).first()).toBeVisible();
  // OrderDetailClient renders a "Brief" / project section — assert it, and that no failure text shows
  await expect(panel.getByText(/load this order/i)).toHaveCount(0);
  await expect(panel.getByText(/Loading order/i)).toHaveCount(0);
  await expect(panel.getByText(/Timeline|Brief|Deliverables|Overview|Project/i).first()).toBeVisible();
});

test('admin: assignment order panel shows real detail (money path)', async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  await page.goto('http://localhost:4500/admin/assignment');
  const firstCode = page.getByRole('button', { name: /^[A-Z]{2,3}-\d+$/ }).first();
  await expect(firstCode).toBeVisible();
  await firstCode.click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/load this order/i)).toHaveCount(0);
  await expect(panel.getByText(/Timeline|Brief|Deliverables|Overview|Project/i).first()).toBeVisible();
});
