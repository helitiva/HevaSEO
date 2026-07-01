import { test, expect } from '@playwright/test';

// FEATURE: the public quick-checkout HTTP endpoint (money-in). Hits the REAL Next route on the running
// server (server-priced, provision/link, materialize). Turnstile is off by default (no TURNSTILE_SECRET)
// so these requests pass the bot gate; the refuse/validation branches are exercised directly.
const ENDPOINT = '/api/public/checkout';
const uniqEmail = () => `e2e.checkout.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@e2e.test`;
const validBody = (over: Record<string, unknown> = {}) => ({
  serviceSlug: 'keyword-research', packageId: 'standard', name: 'E2E Buyer', email: uniqEmail(), ...over,
});

test('valid quick-checkout provisions a new customer + materializes an order', async ({ request }) => {
  const res = await request.post(ENDPOINT, { data: validBody() });
  expect(res.status(), await res.text()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.orderCode).toMatch(/^QO-\d+$/);
  expect(body.amount).toBe(39);                 // server-priced (client sends no total)
  expect(body.account?.tempPassword).toBeTruthy(); // new email → temp password issued
  expect(body.account?.existing).toBe(false);
});

test('missing required fields → 400', async ({ request }) => {
  const res = await request.post(ENDPOINT, { data: { serviceSlug: 'keyword-research' } });
  expect(res.status()).toBe(400);
  expect((await res.json()).ok).toBe(false);
});

test('unknown service → 404', async ({ request }) => {
  const res = await request.post(ENDPOINT, { data: validBody({ serviceSlug: 'not-a-real-service' }) });
  expect(res.status()).toBe(404);
});

test('invalid email → 400', async ({ request }) => {
  const res = await request.post(ENDPOINT, { data: validBody({ email: 'not-an-email' }) });
  expect(res.status()).toBe(400);
});

test('SECURITY: checkout refuses a privileged (team) email → 409', async ({ request }) => {
  // admin@hevaseo.com is a seeded ADMIN profile; the storefront must never provision/claim against it.
  const res = await request.post(ENDPOINT, { data: validBody({ email: 'admin@hevaseo.com' }) });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toMatch(/team account/i);
});

test('an existing customer email attaches the order without a new password', async ({ request }) => {
  const res = await request.post(ENDPOINT, { data: validBody({ email: 'jane@acme.com', name: 'Jane Doe' }) });
  expect(res.status(), await res.text()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.account?.existing).toBe(true);    // claimed account → login link only
  expect(body.account?.tempPassword).toBeFalsy();
});
