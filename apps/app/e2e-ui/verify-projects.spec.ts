import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

const SHOTS = process.env.SHOTS || '/private/tmp/claude-501/-Users-huy-Desktop-Projects-Web2-hevaseo-platform/ee2814f6-f9ed-4c8c-9e62-d099dfc8570d/scratchpad/demo-shots';

// Item 6: a customer can create a folder + project and they persist to the backend (survive a reload).
test('customer creates a folder + project that persist', async ({ page }) => {
  const tag = Date.now().toString(36);
  const folderName = `QA Folder ${tag}`;
  const domain = `qa-${tag}.com`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });

  // create a folder
  await page.getByRole('button', { name: 'Folder' }).first().click();
  await page.getByPlaceholder('e.g. Retail clients').fill(folderName);
  await page.getByRole('button', { name: /Create folder/i }).click();
  await expect(page.getByText(folderName).first()).toBeVisible({ timeout: 10_000 });

  // create a project (into that folder)
  await page.getByRole('button', { name: /New project/i }).first().click();
  await page.getByPlaceholder('example.com').fill(domain);
  await page.getByRole('button', { name: /Create project/i }).click();
  await expect(page.getByText(domain).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${SHOTS}/verify_projects_created.png` });

  // RELOAD → both survive (proves DB persistence, not client-only state)
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(folderName).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(domain).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${SHOTS}/verify_projects_persisted.png` });
});
