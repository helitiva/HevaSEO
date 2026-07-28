import { test, expect } from '@playwright/test';

// One-click "Log in as" buttons on /login must sign in (no reCAPTCHA) and land on each role's home.
const CASES = [
  { label: 'Customer', home: /\/dashboard/ },
  { label: 'Staff', home: /\/staff/ },
  { label: 'Manager', home: /\/manager/ },
  { label: 'Admin', home: /\/admin/ },
  { label: 'Affiliate', home: /\/affiliate/ },
];

for (const c of CASES) {
  test(`quick login as ${c.label} → ${c.home}`, async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Log in as')).toBeVisible();
    await page.getByRole('button', { name: c.label, exact: true }).click();
    await expect(page).toHaveURL(c.home, { timeout: 15_000 });
  });
}
