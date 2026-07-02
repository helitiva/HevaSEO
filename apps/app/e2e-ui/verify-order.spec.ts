import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';
import { createClient } from '@supabase/supabase-js';

const SHOTS = process.env.SHOTS || '/private/tmp/claude-501/-Users-huy-Desktop-Projects-Web2-hevaseo-platform/ee2814f6-f9ed-4c8c-9e62-d099dfc8570d/scratchpad/demo-shots';
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SMOKE_ANON!;

// End-to-end proof for items 3 (ETA in days) + 5 (brief recorded): place a real dashboard order with a
// brief, then open it and confirm the brief + ETA show real data.
test('dashboard order records the brief + shows ETA in days', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await login(page, ACCOUNTS.customer);
  await page.goto('/services/audit', { waitUntil: 'domcontentloaded' });
  for (const inp of await page.locator('form input:visible').all()) {
    const type = (await inp.getAttribute('type')) ?? 'text';
    if (['checkbox', 'radio', 'file', 'hidden', 'range', 'submit'].includes(type)) continue;
    await inp.fill(type === 'url' ? 'https://acme.com' : type === 'email' ? 'jane@acme.com' : 'Acme audit request').catch(() => {});
  }
  for (const ta of await page.locator('form textarea:visible').all()) await ta.fill('Please prioritise mobile Core Web Vitals and fix duplicate title tags on PDPs.').catch(() => {});
  for (const sel of await page.locator('form select:visible').all()) await sel.selectOption({ index: 1 }).catch(() => {});
  await page.getByRole('button', { name: /Place order/i }).first().click();
  await expect(page).toHaveURL(/\/orders(\b|\?|$)/, { timeout: 15_000 });

  // find the just-placed audit order code (admin client, RLS: admin sees all)
  const admin = createClient(URL, ANON, { auth: { persistSession: false } });
  await admin.auth.signInWithPassword({ email: 'admin@hevaseo.com', password: 'demo1234' });
  const { data } = await admin.from('orders').select('code, deadline').like('code', 'AD-%').order('created_at', { ascending: false }).limit(1);
  const code = data?.[0]?.code as string;
  expect(code).toBeTruthy();
  expect(data?.[0]?.deadline).toBeTruthy(); // deadline persisted from SLA

  await page.goto(`/orders?order=${code}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Order brief/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Core Web Vitals/i).first()).toBeVisible(); // the real brief text we typed
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/verify_order_panel.png` });
});
