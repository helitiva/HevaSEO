#!/usr/bin/env node
// Doc-coverage linter: finds DRIFT between the code surface and the docs.
//
// Two deterministic checks (semantic correctness is NOT covered — that needs an LLM pass):
//   1. Route coverage  — every route in routes.json should be named in docs/FEATURES.md.
//   2. Export coverage — every exported symbol in lib/ + data/ (non-test) should be mentioned
//      in FEATURES.md or DATA-MODEL.md. Surfaces capabilities that exist in code but no doc
//      describes (this is the class of gap that hid "gig pay").
//
// Usage:  node scripts/crawl/doc-coverage.mjs            (human report)
//         node scripts/crawl/doc-coverage.mjs --all       (also flag types/consts, very noisy)
//         node scripts/crawl/doc-coverage.mjs --json      (machine output)
//         node scripts/crawl/doc-coverage.mjs --ci        (exit 1 if any gap — for CI)
//
// By default only BEHAVIORS are checked — exported functions + hooks (`useX`). Types, interfaces,
// enums and data constants are implementation detail the docs needn't name one-by-one, so they're
// excluded unless --all. This is the high-signal mode: the "gig pay" gap was an undocumented
// function (`gigPay`/`effectivePay`), and that class is exactly what this catches.
//
// Tune the ignore lists below as the docs intentionally omit internal helpers.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO = join(__dirname, '..', '..');
const APP = join(REPO, 'apps/app/src');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const ciMode = args.has('--ci');

// ── Doc corpus ────────────────────────────────────────────────────────────────
const FEATURES = readFileSync(join(REPO, 'docs/FEATURES.md'), 'utf8');
const DATA_MODEL = readFileSync(join(REPO, 'docs/DATA-MODEL.md'), 'utf8');
const DOC_CORPUS = FEATURES + '\n' + DATA_MODEL;

// ── Check 1: route coverage ─────────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(join(__dirname, 'routes.json'), 'utf8'));
const ROUTE_IGNORE = new Set(['/']); // root redirect — nothing to document
const undocumentedRoutes = manifest.routes
  .map((r) => r.url)
  .filter((url) => !ROUTE_IGNORE.has(url))
  .filter((url) => !FEATURES.includes(url));

// ── Check 2: export coverage ────────────────────────────────────────────────────
// Symbols the docs legitimately never need to name (framework glue, trivial helpers).
const EXPORT_IGNORE = new Set([
  'metadata', 'default', 'generateMetadata',
]);
// Whole files whose exports are implementation detail, not "features".
const FILE_IGNORE = [/\.test\.tsx?$/, /\.d\.ts$/];

const allExports = args.has('--all');
// One regex captures the declaration KIND + the symbol name; mode decides what to keep.
const EXPORT_RE = /export\s+(?:async\s+)?(function|const|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g;
// Default = behaviors only: function declarations + hooks (`use`-prefixed consts). --all keeps everything.
const keepExport = (kind, name) =>
  allExports || kind === 'function' || (kind === 'const' && /^use[A-Z]/.test(name));

function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...collectFiles(abs));
    else if (/\.tsx?$/.test(entry) && !FILE_IGNORE.some((re) => re.test(entry))) out.push(abs);
  }
  return out;
}

const sourceFiles = [join(APP, 'lib'), join(APP, 'data')].flatMap(collectFiles);
const undocumentedExports = [];
for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  const rel = file.replace(REPO + '/', '');
  for (const m of text.matchAll(EXPORT_RE)) {
    const [, kind, name] = m;
    if (EXPORT_IGNORE.has(name) || !keepExport(kind, name)) continue;
    // A doc "mentions" a symbol if its name appears as a whole word anywhere in the corpus.
    const mentioned = new RegExp(`\\b${name}\\b`).test(DOC_CORPUS);
    if (!mentioned) undocumentedExports.push({ name, file: rel });
  }
}

// ── Baseline (accepted gaps) ────────────────────────────────────────────────────
// CI fails only on drift that is NOT already in the baseline, so the existing known gaps don't
// block every build — but any NEW undocumented route/behavior does. `--update-baseline` re-snapshots.
const exportKey = (e) => `${e.file}::${e.name}`;
const BASELINE_PATH = join(__dirname, 'doc-coverage.baseline.json');
function readBaseline() {
  try { return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); }
  catch { return { routes: [], exports: [] }; }
}

if (args.has('--update-baseline')) {
  const baseline = { routes: undocumentedRoutes, exports: undocumentedExports.map(exportKey) };
  // writeFileSync imported lazily to keep the read-only path dependency-free.
  const { writeFileSync } = await import('node:fs');
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`Baseline updated: ${baseline.routes.length} routes, ${baseline.exports.length} exports accepted → ${BASELINE_PATH.replace(REPO + '/', '')}`);
  process.exit(0);
}

const baseline = readBaseline();
const baseRoutes = new Set(baseline.routes);
const baseExports = new Set(baseline.exports);
const newRoutes = undocumentedRoutes.filter((u) => !baseRoutes.has(u));
const newExports = undocumentedExports.filter((e) => !baseExports.has(exportKey(e)));

// ── Output ──────────────────────────────────────────────────────────────────────
const result = {
  routes: { total: manifest.routes.length, undocumented: undocumentedRoutes, new: newRoutes },
  exports: { scannedFiles: sourceFiles.length, undocumented: undocumentedExports, new: newExports },
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n📄 Doc-coverage report\n${'─'.repeat(48)}`);
  console.log(`\nRoutes: ${undocumentedRoutes.length} undocumented / ${manifest.routes.length} total  (${newRoutes.length} new vs baseline)`);
  for (const url of undocumentedRoutes) console.log(`  ${newRoutes.includes(url) ? '🆕' : '✗ '} ${url}`);
  if (!undocumentedRoutes.length) console.log('  ✓ every route is named in FEATURES.md');

  const byFile = new Map();
  for (const e of undocumentedExports) byFile.set(e.file, [...(byFile.get(e.file) ?? []), e.name]);
  console.log(`\nExports: ${undocumentedExports.length} undocumented across ${byFile.size} files (${newExports.length} new vs baseline)`);
  for (const [file, names] of [...byFile].sort()) console.log(`  ✗ ${file}\n      ${names.join(', ')}`);
  if (!undocumentedExports.length) console.log('  ✓ every lib/data export is mentioned in a doc');

  if (ciMode) {
    const newCount = newRoutes.length + newExports.length;
    console.log(`\n${newCount ? `❌ ${newCount} NEW gap(s) vs baseline — document them or run --update-baseline.` : '✅ no new drift vs baseline.'}`);
  }
  console.log('');
}

// CI gates on NEW drift only (baseline = accepted debt).
if (ciMode && (newRoutes.length || newExports.length)) process.exit(1);
