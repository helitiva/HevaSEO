import { test, expect, Page } from '@playwright/test';

// VISUAL REGRESSION — stable public surfaces across breakpoints × themes. Baselines are created on the
// first run with `--update-snapshots`. Authed pages carry live data (dates/balances) that breaks pixel
// baselines, so strict visual regression targets the static auth pages; masked authed snapshots are a
// documented follow-up. Baselines are environment-specific — regenerate (or run in the CI container)
// when the rendering platform changes.
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];
const THEMES = ['light', 'dark'] as const;
const PAGES = [
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
];

async function setTheme(page: Page, theme: string) {
  await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
}

for (const pg of PAGES) {
  for (const bp of BREAKPOINTS) {
    for (const theme of THEMES) {
      test(`${pg.name} @ ${bp.name}/${theme}`, async ({ page }) => {
        await setTheme(page, theme);
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto(pg.path);
        await page.locator('h1, form').first().waitFor();
        await page.evaluate(() => document.fonts?.ready);
        await page.waitForTimeout(300); // let fonts/theme settle
        await expect(page).toHaveScreenshot(`${pg.name}-${bp.name}-${theme}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  }
}
