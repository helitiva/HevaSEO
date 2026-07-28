#!/usr/bin/env node
// Route-manifest generator for the page-crawler pipeline.
//
// Walks apps/app/src/app, derives the public URL for every page.tsx, classifies it by role,
// flags dynamic segments, and records the source file. Dynamic-segment IDs are NOT resolved
// here — that is deferred to the live-verify phase (the crawler grabs a real id from the
// listing page via the dev server), which avoids parsing TS mock data from Node.
//
// Output: scripts/crawl/routes.json  (consumed by Phase 1 audit + Phase 3 verify).
//
// Usage: node scripts/crawl/manifest.mjs

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO = join(__dirname, '..', '..');
const APP_DIR = join(REPO, 'apps/app/src/app');

/** Walk a directory tree, yielding absolute paths to every page.tsx. */
function findPages(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) findPages(abs, out);
    else if (entry === 'page.tsx') out.push(abs);
  }
  return out;
}

/**
 * Convert an app-relative page directory into a public URL.
 * - Route groups like (portal) / (dash) are stripped (they don't appear in the URL).
 * - The root page (app/page.tsx) redirects to /dashboard — recorded as such.
 */
function toUrl(pageAbs) {
  const relDir = relative(APP_DIR, pageAbs).replace(/\/page\.tsx$/, '').replace(/page\.tsx$/, '');
  const segments = relDir.split('/').filter((s) => s && !/^\(.*\)$/.test(s));
  return '/' + segments.join('/');
}

/** Classify a URL into one of the five role surfaces. */
function roleOf(url) {
  if (url.startsWith('/admin')) return 'admin';
  if (url.startsWith('/manager')) return 'manager';
  if (url.startsWith('/staff')) return 'staff';
  if (url.startsWith('/affiliate')) return 'affiliate';
  // Everything else lives in the (portal) group = the customer/user surface.
  return 'customer';
}

const DYNAMIC_RE = /\[([^\]]+)\]/g;

function dynamicParams(url) {
  return [...url.matchAll(DYNAMIC_RE)].map((m) => m[1]);
}

/**
 * For a dynamic route, point at the listing page a real id can be scraped from at crawl time.
 * Heuristic: the parent of the dynamic segment (e.g. /admin/orders/[id] -> /admin/orders).
 */
function discoverFrom(url) {
  return url.replace(/\/\[[^\]]+\].*$/, '');
}

const pages = findPages(APP_DIR).sort();
const routes = pages.map((abs) => {
  const url = toUrl(abs);
  const params = dynamicParams(url);
  const isDynamic = params.length > 0;
  return {
    url,
    role: roleOf(url),
    isDynamic,
    dynamicParams: params,
    discoverFrom: isDynamic ? discoverFrom(url) : null,
    source: relative(REPO, abs),
  };
});

// Root redirect note.
const root = routes.find((r) => r.url === '/');
if (root) root.note = 'redirects to /dashboard';

const byRole = routes.reduce((acc, r) => {
  acc[r.role] = (acc[r.role] || 0) + 1;
  return acc;
}, {});

const manifest = {
  generatedAt: new Date().toISOString(),
  devUrl: 'http://localhost:4400',
  total: routes.length,
  byRole,
  // Identity cookies the live-verify phase may set to render a specific persona (Phase-0 mock).
  identityCookies: {
    staff: 'heva_as',
    customer: 'heva_as_customer',
    mode: 'heva_as_mode',
  },
  routes,
};

const outPath = join(__dirname, 'routes.json');
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote ${routes.length} routes -> ${relative(REPO, outPath)}`);
console.log('By role:', byRole);
const dyn = routes.filter((r) => r.isDynamic);
console.log(`Dynamic routes (${dyn.length}, ids resolved at crawl time):`);
for (const r of dyn) console.log(`  ${r.url}  <- discoverFrom ${r.discoverFrom}`);
