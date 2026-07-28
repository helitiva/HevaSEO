#!/usr/bin/env node
// Contract coverage guard — ensures docs/CONTRACTS.md references EVERY data-access
// module across both apps, so a feature's data layer can never be silently missed.
//
// A module is "covered" if its filename appears anywhere in CONTRACTS.md. Modules that
// are intentionally NOT a backend contract (nav config, tiny UI utils) live in EXEMPT
// with a reason — so exemptions are explicit and reviewable, never silent.
//
// Run: `pnpm contract-coverage` (exit 1 if any module is missing → wire into CI).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = [
  'apps/app/src/data',
  'apps/app/src/lib',
  'apps/web/src/data',
];

// Intentionally not a data-access seam → no CONTRACTS entry required. Reason is mandatory.
const EXEMPT = {
  'adminNav.ts': 'nav config — route gating lives in rbac.ts',
  'managerNav.ts': 'nav config — rbac.ts',
  'staffNav.ts': 'nav config — rbac.ts',
  'affiliateNav.ts': 'nav config — rbac.ts',
  'nav.ts': 'nav config — rbac.ts',
  'today.ts': 'mock clock util (MOCK_TODAY)',
  'relativeTime.ts': 'time-format util',
  'portalBase.ts': 'UI area helper (/staff vs /manager)',
  'hues.ts': 'color util (marketing)',
  'site.ts': 'marketing site config (nav/SEO copy)',
};

const contracts = readFileSync('docs/CONTRACTS.md', 'utf8');
const missing = [];
let scanned = 0;

for (const root of ROOTS) {
  let files;
  try { files = readdirSync(root); } catch { continue; }
  for (const f of files) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
    scanned++;
    if (EXEMPT[f]) continue;
    if (!contracts.includes(f)) missing.push(join(root, f));
  }
}

if (missing.length) {
  console.error(`\n❌ CONTRACTS.md is missing ${missing.length} of ${scanned} data-access module(s):`);
  for (const m of missing) console.error(`   - ${m}`);
  console.error('\nFix: add each to docs/CONTRACTS.md, OR add it to EXEMPT in this script with a reason.');
  process.exit(1);
}

console.log(`✅ CONTRACTS.md covers all ${scanned} data-access modules (${Object.keys(EXEMPT).length} exempt).`);
