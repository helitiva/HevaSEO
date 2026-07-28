import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// The order form's Project/Folder pickers must use the customer's REAL folders (was mock FOLDERS), and a
// project created at order time must persist to /projects.
test('order form folder picker shows real folders, not mock', async ({ page }) => {
  const folderName = `OrderFolder ${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, ACCOUNTS.customer);

  // create a real folder
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Folder' }).first().click();
  await page.getByPlaceholder('e.g. Retail clients').fill(folderName);
  await page.getByRole('button', { name: /Create folder/i }).click();
  await expect(page.getByText(folderName).first()).toBeVisible({ timeout: 10_000 });

  // open the order form → the folder <select> must list the real folder and NOT the mock ones
  await page.goto('/services/backlink', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const opts = await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll('select'));
    const folderSel = sels.find((s) => Array.from(s.options).some((o) => /Auto/i.test(o.textContent ?? '')) && !Array.from(s.options).some((o) => /New project/i.test(o.textContent ?? '')));
    return folderSel ? Array.from(folderSel.options).map((o) => (o.textContent ?? '').trim()) : [];
  });
  expect(opts.join(' | ')).toContain(folderName);        // real folder present
  expect(opts.some((o) => o.includes('E-commerce client'))).toBe(false); // mock folders gone
});
