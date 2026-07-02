import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Repro for the reported bug: creating a folder should show it in the rail immediately, and a project
// created *in* that folder should appear when the folder is selected (not only under "All projects").
test('new folder shows, and a project created in it lands in that folder', async ({ page }) => {
  test.setTimeout(90_000);
  const tag = Date.now().toString(36);
  const folderName = `Folder ${tag}`;
  const domain = `proj-${tag}.com`;
  await page.setViewportSize({ width: 1280, height: 950 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });

  // create a folder → it must appear in the folder rail
  await page.getByRole('button', { name: 'Folder' }).first().click();
  await page.getByPlaceholder('e.g. Retail clients').fill(folderName);
  await page.getByRole('button', { name: /Create folder/i }).click();
  const railFolder = page.locator('.folder-item').filter({ hasText: folderName });
  await expect(railFolder).toBeVisible({ timeout: 10_000 });

  // create a project assigned to that folder
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByPlaceholder('example.com').fill(domain);
  // pick the folder in the modal's folder <select>
  const modalFolderSelect = page.locator('select').filter({ has: page.locator('option', { hasText: folderName }) }).first();
  await modalFolderSelect.selectOption({ label: folderName });
  await page.getByRole('button', { name: /Create project/i }).click();
  await expect(page.getByText(domain).first()).toBeVisible({ timeout: 10_000 });

  // select the folder in the rail → the project must be listed under it
  await railFolder.click();
  await expect(page.getByText(domain).first()).toBeVisible({ timeout: 10_000 });
  // and the folder count should be at least 1
  await expect(railFolder.locator('.folder-count')).toHaveText(/[1-9]/, { timeout: 10_000 });
});
