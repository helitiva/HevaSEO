import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Staff surface health sweep: every nav route loads with the staff shell + its own heading, no crash.
// Also asserts the two staff security invariants: the shell is the Staff shell, and staff cannot enter
// the admin/manager areas (RBAC bounces them back).
type Route = { path: string; needle: RegExp };

const ROUTES: Route[] = [
  { path: '/staff', needle: /Good (morning|afternoon|evening)/i },
  { path: '/staff/tasks', needle: /tasks across \d+ stages/i },
  { path: '/staff/calendar', needle: /laid out by day/i },
  { path: '/staff/deliverables', needle: /Deliverables/ },
  { path: '/staff/inbox', needle: /Inbox/ },
  { path: '/staff/docs', needle: /published for your specialty/i },
  { path: '/staff/notes', needle: /private notebook/i },
  { path: '/staff/finance', needle: /your pay only/i },
  { path: '/staff/performance', needle: /My standing/i },
  { path: '/staff/notifications', needle: /Assignments, reviews/i },
  { path: '/staff/settings', needle: /profile, availability/i },
];

const CRASH = /Application error|Unhandled Runtime|could not be found|Internal Server Error|This page could not/i;

test('staff · all 11 nav routes load healthy with the staff shell', async ({ page }) => {
  await login(page, ACCOUNTS.staff);
  const fails: string[] = [];

  for (const r of ROUTES) {
    await page.goto(r.path);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(150);

    if (await page.getByText(CRASH).count()) fails.push(`${r.path}: CRASH/not-found overlay`);
    if ((await page.locator('aside').getByText(/Staff/).count()) === 0) fails.push(`${r.path}: staff shell brand missing`);
    if ((await page.getByText(r.needle).count()) === 0) fails.push(`${r.path}: heading ${r.needle} not found`);
  }

  expect(fails, `Unhealthy staff routes:\n  ${fails.join('\n  ')}`).toEqual([]);
});

test('staff · cannot enter the admin or manager areas (RBAC bounce)', async ({ page }) => {
  await login(page, ACCOUNTS.staff);
  for (const forbidden of ['/admin', '/admin/orders', '/manager', '/manager/assignment']) {
    await page.goto(forbidden);
    // the RBAC guard redirects to /staff — wait for the bounce to settle, then assert
    await page.waitForURL((url) => !/\/(admin|manager)(\/|$)/.test(url.pathname), { timeout: 8000 }).catch(() => {});
    expect(new URL(page.url()).pathname, `staff should be bounced out of ${forbidden}`).not.toMatch(/\/(admin|manager)(\/|$)/);
  }
});
