import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Manager surface health sweep: every nav route loads, shows the manager shell (scope chip) + its own
// distinctive heading, no crash overlay. Pod/org surfaces must stay money-blind (no currency leaks);
// /manager/finance is the manager's OWN pay and is deliberately excluded from the money-blind check.
type Route = { path: string; needle: RegExp; moneyBlind?: boolean };

const ROUTES: Route[] = [
  { path: '/manager', needle: /pod/i, moneyBlind: true },
  { path: '/manager/orders', needle: /Orders/, moneyBlind: true },
  { path: '/manager/assignment', needle: /Route work to your pod/i, moneyBlind: true },
  { path: '/manager/review', needle: /Deliverables awaiting QA/i, moneyBlind: true },
  { path: '/manager/tickets', needle: /tickets in your pod/i },
  { path: '/manager/inbox', needle: /Inbox/ },
  { path: '/manager/performance', needle: /My performance/i },
  { path: '/manager/finance', needle: /salary/i }, // OWN pay — money allowed
  { path: '/manager/customers', needle: /Customers/, moneyBlind: true },
  { path: '/manager/staff', needle: /My staff/i, moneyBlind: true },
  { path: '/manager/docs', needle: /published for managers/i },
  { path: '/manager/notes', needle: /private notebook/i },
  { path: '/manager/audit', needle: /Audit log/i },
  { path: '/manager/settings', needle: /notification preferences/i },
];

const CRASH = /Application error|Unhandled Runtime|could not be found|Internal Server Error|This page could not/i;
const CURRENCY = /\$\s?\d[\d,]*/; // $1,200 etc.

test('manager · all 14 nav routes load healthy (+ money-blind on pod surfaces)', async ({ page }) => {
  await login(page, ACCOUNTS.manager);
  const fails: string[] = [];

  for (const r of ROUTES) {
    await page.goto(r.path);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(200); // let the server component paint

    const crash = await page.getByText(CRASH).count();
    if (crash > 0) fails.push(`${r.path}: CRASH/not-found overlay`);

    const chip = await page.getByText(/[’']s pod/).count();
    if (chip === 0) fails.push(`${r.path}: manager scope chip missing (shell didn't load)`);

    const head = await page.getByText(r.needle).count();
    if (head === 0) fails.push(`${r.path}: heading ${r.needle} not found`);

    if (r.moneyBlind) {
      const body = await page.locator('body').innerText();
      const m = body.match(CURRENCY);
      if (m) fails.push(`${r.path}: LEAKED currency "${m[0]}" — should be money-blind`);
    }
  }

  expect(fails, `Unhealthy manager routes:\n  ${fails.join('\n  ')}`).toEqual([]);
});
