import { defineConfig, devices } from '@playwright/test';

// UI E2E for the critical journeys. Runs against the real Next app + local Supabase (pristine seed).
// Prereq: supabase running + seeded (pnpm db:reset). The webServer auto-starts `next dev` on :4400.
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
    baseURL: process.env.UI_BASE_URL || 'http://localhost:4455',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Dedicated test port (4455) so it never collides with a dev server already on 4400.
    command: 'pnpm exec next dev --turbopack --port 4455',
    url: 'http://localhost:4455/login',
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
