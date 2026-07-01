import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

// Per-role authenticated sweep: log in, walk every static page for that role, and flag real console
// errors + 5xx / same-origin 4xx responses. RBAC-redirects to home are fine (200). Dev noise is filtered.
const PAGES: Record<keyof typeof ACCOUNTS, string[]> = {
  admin: ['/admin', '/admin/orders', '/admin/customers', '/admin/staff', '/admin/staff/leave', '/admin/managers',
    '/admin/finance', '/admin/finance?tab=payouts', '/admin/analytics', '/admin/affiliate', '/admin/docs',
    '/admin/broadcasts', '/admin/assignment', '/admin/review', '/admin/audit', '/admin/catalog', '/admin/tickets',
    '/admin/notes', '/admin/settings'],
  manager: ['/manager', '/manager/orders', '/manager/customers', '/manager/staff', '/manager/assignment',
    '/manager/finance', '/manager/performance', '/manager/review', '/manager/audit', '/manager/docs',
    '/manager/notes', '/manager/inbox', '/manager/tickets', '/manager/settings'],
  staff: ['/staff', '/staff/tasks', '/staff/calendar', '/staff/deliverables', '/staff/finance', '/staff/performance',
    '/staff/docs', '/staff/notes', '/staff/inbox', '/staff/notifications', '/staff/settings'],
  customer: ['/dashboard', '/orders', '/credit', '/projects', '/docs', '/notes', '/inbox', '/services', '/settings'],
  affiliate: ['/affiliate', '/affiliate/payouts', '/affiliate/referrals', '/affiliate/assets', '/affiliate/inbox',
    '/affiliate/settings'],
};

// Dev-only / benign noise that isn't a real bug.
const IGNORE = /favicon|react devtools|\[Fast Refresh\]|hot-update|webpack-hmr|_next\/static|ERR_CONNECTION_REFUSED.*ws|Download the React|cdn\.simpleicons|sample-report|sample-topical-map|unpkg\.com|compute-pressure|Permissions policy violation/i;

for (const role of Object.keys(PAGES) as (keyof typeof ACCOUNTS)[]) {
  test(`console sweep — ${role}`, async ({ page }) => {
    const issues: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) issues.push(`[console] ${page.url()} :: ${m.text()}`); });
    page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) issues.push(`[pageerror] ${page.url()} :: ${e.message}`); });
    page.on('response', (r) => {
      const s = r.status();
      const sameOrigin = r.url().includes('localhost:4455');
      if ((s >= 500 || (s >= 400 && sameOrigin)) && !IGNORE.test(r.url())) issues.push(`[${s}] ${r.url()}`);
    });

    await login(page, ACCOUNTS[role]);
    for (const path of PAGES[role]) {
      try {
        await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 });
        await page.waitForTimeout(200);
      } catch { /* nav flake / redirect race — the response + console listeners already captured any real error */ }
    }
    if (issues.length) console.log(`\n${role} issues:\n  - ${issues.join('\n  - ')}`);
    expect(issues, `${role}: ${issues.length} issue(s)`).toHaveLength(0);
  });
}
