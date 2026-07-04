import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// A manager could not assign work because their pod roster came back empty (staff_details had no manager
// RLS policy) → empty "Pick" dropdown + NaN utilization. After the pod policy, the roster populates and
// the manager can assign a pod order to their staff.
test('manager sees pod staff and can assign a queue order', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await login(page, ACCOUNTS.manager);
  await page.goto('/manager/assignment', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  // roster populated: pod staff visible, utilization is a real number (not NaN)
  await expect(page.getByText('Mai T.').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('body')).not.toContainText('NaN');

  // open the first order's staff picker → assign to the pod staff
  await page.getByRole('button', { name: /^Pick/ }).first().click();
  await page.waitForTimeout(300);
  const assign = page.getByRole('button', { name: 'Assign', exact: true });
  await assign.first().click();
  // success (the log records "Assigned … → …"), not an over-capacity/authorization warning
  await expect(page.getByText(/Assigned /).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Only an admin|not authorized|NOT_/i)).toHaveCount(0);
});
