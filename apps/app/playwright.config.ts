import { defineConfig, devices } from '@playwright/test';

// UI E2E for the critical journeys. Runs against the real Next app + local Supabase (pristine seed).
// Prereq: supabase running + seeded (pnpm db:reset). reuseExistingServer means if the app is already
// up on :4500 it is reused (no rebuild, no clobber); otherwise `pnpm dev` starts it on :4500.
//   pnpm --filter @heva/app exec playwright test
export default defineConfig({
  testDir: './e2e-ui',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.UI_BASE_URL || 'http://localhost:4500',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev', // next dev --port 4500; skipped entirely when :4500 is already serving
    url: 'http://localhost:4500/login',
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
