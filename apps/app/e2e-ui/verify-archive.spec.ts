import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Folder "Move to Archive": the folder's projects are archived (not deleted) and appear under the
// always-present Archive rail entry; they can be restored. Also: a single click selects a folder.
test('folder move-to-archive + restore, and single-click folder select', async ({ page }) => {
  test.setTimeout(90_000);
  const tag = Date.now().toString(36);
  const folderName = `Arch ${tag}`;
  const domain = `arch-${tag}.com`;
  await page.setViewportSize({ width: 1280, height: 950 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });

  // Archive entry is always present
  const archiveRow = page.locator('.folder-item').filter({ hasText: 'Archive' });
  await expect(archiveRow).toBeVisible();

  // create a folder + a project in it
  await page.getByRole('button', { name: 'Folder' }).first().click();
  await page.getByPlaceholder('e.g. Retail clients').fill(folderName);
  await page.getByRole('button', { name: /Create folder/i }).click();
  const folderRow = page.locator('.folder-item').filter({ hasText: folderName });
  await expect(folderRow).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByPlaceholder('example.com').fill(domain);
  await page.locator('select').filter({ has: page.locator('option', { hasText: folderName }) }).first().selectOption({ label: folderName });
  await page.getByRole('button', { name: /Create project/i }).click();
  await expect(page.getByText(domain).first()).toBeVisible({ timeout: 10_000 });

  // SINGLE click selects the folder (the header reflects it) — the remount lag bug is gone
  await folderRow.getByRole('button').first().click();
  await expect(page.locator('section').getByText(folderName, { exact: true }).first()).toBeVisible({ timeout: 5_000 });

  // folder gear → the action reads "Move to Archive" (not Delete)
  await folderRow.hover();
  await folderRow.getByRole('button', { name: /Folder settings/i }).click();
  await expect(page.getByRole('button', { name: 'Move to Archive' })).toBeVisible();
  await page.getByRole('button', { name: 'Move to Archive' }).click();
  await page.getByRole('button', { name: /Move to Archive/i }).last().click(); // confirm in modal

  // folder gone from rail; project now lives under Archive
  await expect(page.locator('.folder-item').filter({ hasText: folderName })).toHaveCount(0, { timeout: 10_000 });
  await archiveRow.getByRole('button').first().click();
  await expect(page.getByText(domain).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Archived').first()).toBeVisible();

  // restore it via the project gear menu
  await page.locator('.pcard').filter({ hasText: domain }).getByRole('button', { name: /Project settings/i }).click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText(domain)).toHaveCount(0, { timeout: 10_000 }); // gone from Archive view
});

// A single project can be archived straight from its gear menu (no dragging) and the Archive count bumps.
test('project gear "Move to Archive" archives it and updates the count', async ({ page }) => {
  test.setTimeout(90_000);
  const domain = `pm-${Date.now().toString(36)}.com`;
  await page.setViewportSize({ width: 1280, height: 950 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  const archiveRow = page.locator('.folder-item').filter({ hasText: 'Archive' });
  const before = Number((await archiveRow.locator('.folder-count').textContent())?.trim() || '0');

  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByPlaceholder('example.com').fill(domain);
  await page.getByRole('button', { name: /Create project/i }).click();
  const card = page.locator('.pcard').filter({ hasText: domain });
  await expect(card).toBeVisible({ timeout: 10_000 });

  await card.getByRole('button', { name: /Project settings/i }).click();
  await page.getByRole('button', { name: 'Move to Archive' }).click();
  await expect(page.locator('.pcard').filter({ hasText: domain })).toHaveCount(0, { timeout: 10_000 }); // left All
  await expect(archiveRow.locator('.folder-count')).toHaveText(String(before + 1), { timeout: 10_000 }); // count bumped
  await archiveRow.getByRole('button').first().click();
  await expect(page.getByText(domain).first()).toBeVisible({ timeout: 10_000 });
});
