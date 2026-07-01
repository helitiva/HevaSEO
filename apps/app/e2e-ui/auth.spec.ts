import { test, expect } from '@playwright/test';
import { login, fillLogin, ACCOUNTS, HOME } from './helpers';

// Critical journey: every role signs in through the real form and lands on its own home surface.
for (const [role, email] of Object.entries(ACCOUNTS)) {
  test(`login as ${role} → lands on ${HOME[role as keyof typeof HOME]}`, async ({ page }) => {
    await login(page, email);
    await expect(page).toHaveURL(new RegExp(`${HOME[role as keyof typeof HOME]}(/|$|\\?)`));
  });
}

test('wrong password keeps the user on /login', async ({ page }) => {
  await fillLogin(page, ACCOUNTS.customer, 'nope-wrong');
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated /admin redirects to /login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
});
