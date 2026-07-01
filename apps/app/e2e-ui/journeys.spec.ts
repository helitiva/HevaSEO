import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';
import { seedPendingStaffPayout, hasApiCreds } from './api';

// Deeper multi-step journeys that mutate real state through the UI.

test('customer tops up credit through the UI (real credit)', async ({ page }) => {
  await login(page, ACCOUNTS.customer);
  await page.goto('/credit');
  // PayPal path is provider-agnostic (no Stripe Element / card fields needed).
  await page.getByRole('button', { name: 'PayPal', exact: true }).click();
  await page.getByRole('button', { name: /Continue with PayPal/i }).click();
  await expect(page.getByText(/Topped up \$/i)).toBeVisible({ timeout: 15_000 });
});

test('admin resolves (rejects) a staff payout through the UI', async ({ page }) => {
  test.skip(!hasApiCreds, 'needs SMOKE_ANON/SMOKE_SVC to seed a pending payout');
  await seedPendingStaffPayout();
  await login(page, ACCOUNTS.admin);
  await page.goto('/admin/finance');
  const rejectBtns = page.getByRole('button', { name: 'Reject' });
  await expect(rejectBtns.first()).toBeVisible({ timeout: 15_000 });
  const before = await rejectBtns.count();
  await rejectBtns.first().click();
  // resolve_payout → revalidatePath refreshes the RSC → the actionable row drops.
  await expect(async () => {
    expect(await page.getByRole('button', { name: 'Reject' }).count()).toBeLessThan(before);
  }).toPass({ timeout: 15_000 });
});

test('staff opens a task and submits a deliverable (when submittable)', async ({ page }) => {
  await login(page, ACCOUNTS.staff);
  await page.goto('/staff/tasks');
  const firstTask = page.locator('a[href^="/staff/tasks/"]').first();
  if ((await firstTask.count()) === 0) { test.skip(true, 'no tasks in the staff list'); return; }
  await firstTask.click();
  await page.waitForURL(/\/staff\/tasks\/.+/);
  const note = page.locator('#deliverable-note');
  if ((await note.count()) === 0) {
    // task not in a submittable state → assert the detail rendered (covered fully at the backend layer)
    await expect(page.locator('h1, h2').first()).toBeVisible();
    return;
  }
  await page.locator('input[placeholder*="external link"]').fill('https://docs.example.com/e2e-deliverable');
  await note.fill('E2E deliverable — please review the money pages.');
  await page.getByRole('button', { name: /Submit v\d+ for review/i }).click();
  await expect(page.getByText(/Submitted for review/i)).toBeVisible({ timeout: 15_000 });
});
