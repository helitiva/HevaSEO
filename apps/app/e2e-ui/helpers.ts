import { Page, expect } from '@playwright/test';

export const ACCOUNTS = {
  admin: 'admin@hevaseo.com',
  manager: 'sofia@hevaseo.com',
  staff: 'mai@hevaseo.com',
  customer: 'jane@acme.com',
  affiliate: 'jane@janeseo.com',
} as const;

export const HOME = {
  admin: '/admin',
  manager: '/manager',
  staff: '/staff',
  customer: '/dashboard',
  affiliate: '/affiliate',
} as const;

// Stub the reCAPTCHA v2 widget so the token is issued deterministically (no Google iframe/network).
// The login component skips loading Google's script when window.grecaptcha.render already exists, then
// calls our render(), which fires the callback with a test token → the Sign in button enables.
export async function stubRecaptcha(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { grecaptcha: unknown }).grecaptcha = {
      render: (_el: HTMLElement, opts: { callback: (t: string) => void }) => { setTimeout(() => opts.callback('e2e-recaptcha-token'), 0); return 1; },
      reset: () => {},
    };
  });
}

// Fill the login form (reCAPTCHA stubbed) and click Sign in. Does NOT wait for redirect.
export async function fillLogin(page: Page, email: string, password: string) {
  await stubRecaptcha(page);
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const btn = page.getByRole('button', { name: /sign in/i });
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.click();
}

// Sign in via the real login form; resolves once the app has redirected away from /login.
export async function login(page: Page, email: string, password = 'demo1234') {
  await fillLogin(page, email, password);
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

export async function expectNoConsoleErrors(page: Page, fn: () => Promise<void>) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await fn();
  const real = errors.filter((e) => !/favicon|Download the React DevTools|hydrat/i.test(e));
  expect(real, `console errors:\n${real.join('\n')}`).toHaveLength(0);
}
