import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Critical journey: each portal renders its primary surface after login, and cross-role access is gated.
test('admin opens the orders board', async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  await page.goto('/admin/orders');
  await expect(page.locator('body')).toContainText(/order/i);
});

test('customer dashboard renders', async ({ page }) => {
  await login(page, ACCOUNTS.customer);
  await page.goto('/dashboard');
  await expect(page.locator('h1, h2').first()).toBeVisible();
});

test('staff portal renders', async ({ page }) => {
  await login(page, ACCOUNTS.staff);
  await page.goto('/staff');
  await expect(page.locator('h1, h2').first()).toBeVisible();
});

test('affiliate dashboard renders', async ({ page }) => {
  await login(page, ACCOUNTS.affiliate);
  await page.goto('/affiliate');
  await expect(page.locator('h1, h2').first()).toBeVisible();
});

test('a customer is blocked from the admin area (RBAC gate)', async ({ page }) => {
  await login(page, ACCOUNTS.customer);
  await page.goto('/admin');
  await expect(page).not.toHaveURL(/\/admin(\/|$)/);
});
