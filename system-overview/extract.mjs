#!/usr/bin/env node
/**
 * extract.mjs — trích "bằng chứng tính năng" từ SOURCE CODE React của từng route,
 * rồi đối chiếu với mô tả trong data.js để flag cái gì CÓ trong code mà CHƯA có trong docs.
 *
 * Chạy:  node system-overview/extract.mjs
 * Kết quả: ghi system-overview/evidence.json + in báo cáo "ứng viên chưa tài liệu hóa".
 *
 * KHÔNG cần trình duyệt / dev-server. Đọc tĩnh, đi theo import graph (page.tsx → các
 * component nó dùng), trích: heading/label/cột bảng/nút (JSX text + prop label), tên
 * component, comment (kể cả planned/TODO — thứ DOM không có). Đây là CÔNG CỤ PHÁT HIỆN
 * GAP: nó liệt kê ứng viên, con người vẫn viết câu tier1/tier2 cuối cùng (biên tập).
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const APP = join(ROOT, 'apps', 'app', 'src');
const norm = (p) => p.replaceAll('\\', '/');

/* ---------- 1. Tìm mọi route entry (page.tsx, bỏ redirect-stub) ---------- */
function walk(dir, pred, out = []) {
  let entries; try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (['node_modules', '.next', 'dist'].includes(name)) continue;
      walk(full, pred, out);
    } else if (pred(full)) out.push(full);
  }
  return out;
}
const allPages = walk(join(APP, 'app'), (p) => p.endsWith('page.tsx'));
const isRedirectStub = (p) => { try { const t = readFileSync(p, 'utf8'); return /redirect\(/.test(t) && !/return\s*\(/.test(t); } catch { return false; } };
function routeOf(p) {
  const after = norm(p).split('/app/src/app/')[1] || '';
  const rel = after.replace(/\/page\.tsx$/, '').replace(/^page\.tsx$/, '');
  const segs = rel.split('/').filter((s) => s && !/^\(.*\)$/.test(s));
  return '/' + segs.join('/');
}
const routePages = allPages.filter((p) => !isRedirectStub(p));

/* ---------- 2. Resolve import graph cho 1 route (đi sâu trong src, bỏ /data) ---------- */
function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(APP, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // module ngoài (react, next…) → bỏ
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const cand = base + ext;
    if (existsSync(cand)) return cand;
  }
  return existsSync(base) ? base : null;
}
function graphFor(entry, maxDepth = 4) {
  const seen = new Set();
  const files = [];
  const queue = [[entry, 0]];
  while (queue.length) {
    const [file, depth] = queue.shift();
    if (seen.has(file) || depth > maxDepth) continue;
    seen.add(file);
    const within = norm(file).includes('/apps/app/src/');
    const isData = norm(file).includes('/src/data/'); // lớp mock — nhiều nhiễu, bỏ khỏi trích
    if (!within) continue;
    files.push(file);
    if (isData) continue; // không đi sâu vào data
    let txt; try { txt = readFileSync(file, 'utf8'); } catch { continue; }
    for (const m of txt.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const r = resolveSpec(m[1], file); if (r) queue.push([r, depth + 1]);
    }
    for (const m of txt.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const r = resolveSpec(m[1], file); if (r) queue.push([r, depth + 1]);
    }
  }
  return files;
}

/* ---------- 3. Trích evidence từ 1 file ---------- */
const TW = /\b(text-|bg-|flex|grid|gap-|p[xytblr]?-|m[xytblr]?-|rounded|border|font-|items-|justify-|w-|h-|absolute|relative|hidden|inline|space-|leading-|tracking-|shadow|opacity|z-|top-|left-|right-|bottom-|min-|max-|col-|row-|order-|sr-only|truncate|overflow-|whitespace|ring-|ph-|fill)/;
const STOP = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'true', 'false', 'null', 'undefined', 'div', 'span', 'className', 'style', 'href', 'key', 'map', 'props', 'return', 'const', 'function', 'string', 'number', 'boolean']);
const cleanStr = (s) => s.replace(/\s+/g, ' ').trim();
const looksLikeClass = (s) => s.includes(' ') && TW.test(s);
// Loại chuỗi "giống code" — TS generic <…>, biểu thức, khai báo… lọt qua regex JSX-text.
const CODEISH = /[;=(){}\[\]<>`]|=>|&&|\|\||\?\?|\.\w+\(|::|\bconst\b|\buseState\b|\buseRef\b|\bRecord\b|\breturn\b/;
const isMeaningful = (s) =>
  s.length >= 2 && s.length <= 70 && /[A-Za-zÀ-ỹ]/.test(s)
  && !looksLikeClass(s) && !/^[\d\s\W]+$/.test(s) && !CODEISH.test(s);

function extractFile(file) {
  let txt; try { txt = readFileSync(file, 'utf8'); } catch { return null; }
  const labels = new Set(), headings = new Set(), comments = new Set(), components = new Set();

  // prop labels: label/title/subtitle/placeholder/header/aria-label/tooltip/name = '...'
  for (const m of txt.matchAll(/\b(?:label|title|subtitle|placeholder|heading|header|aria-label|tooltip|name)\s*[:=]\s*['"]([^'"]{2,70})['"]/g)) {
    const s = cleanStr(m[1]); if (isMeaningful(s)) labels.add(s);
  }
  // JSX text giữa > và < (không chứa { } biểu thức)
  for (const m of txt.matchAll(/>([^<>{}\n][^<>{}]{1,68})</g)) {
    const s = cleanStr(m[1]); if (isMeaningful(s) && /[A-Za-zÀ-ỹ]/.test(s)) labels.add(s);
  }
  // heading JSX <h1..h4>...< hoặc PageHeader title
  for (const m of txt.matchAll(/<h[1-4][^>]*>([^<{]{2,70})</g)) { const s = cleanStr(m[1]); if (isMeaningful(s)) headings.add(s); }
  // component dùng trong JSX
  for (const m of txt.matchAll(/<([A-Z][A-Za-z0-9]+)/g)) { if (!STOP.has(m[1])) components.add(m[1]); }
  // comment // và /* */ (giữ comment có ý nghĩa, đánh dấu planned/TODO)
  for (const m of txt.matchAll(/\/\/\s?(.{6,120})/g)) { const s = cleanStr(m[1]); if (/[A-Za-zÀ-ỹ]/.test(s) && !s.startsWith('/')) comments.add(s); }
  for (const m of txt.matchAll(/\/\*+([\s\S]{6,200}?)\*\//g)) { const s = cleanStr(m[1]); if (/[A-Za-zÀ-ỹ]/.test(s)) comments.add(s.slice(0, 120)); }

  return { labels: [...labels], headings: [...headings], comments: [...comments], components: [...components] };
}

/* ---------- 4. Nạp data.js (eval an toàn) → route → text mô tả ---------- */
const dataTxt = readFileSync(join(HERE, 'data.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(dataTxt, sandbox);
const HEVA = sandbox.window.HEVA || {};
const docByRoute = {};
for (const role of HEVA.roles || []) {
  const screens = role.groups ? role.groups.flatMap((g) => g.items) : (role.screens || []);
  for (const sc of screens) {
    if (!sc.route || !sc.route.startsWith('/')) continue;
    const text = [sc.name, sc.desc, ...(sc.tier1 || []), ...(sc.tier2 || []), ...(sc.detail || [])].join(' ').toLowerCase();
    docByRoute[sc.route] = (docByRoute[sc.route] || '') + ' ' + text;
  }
}

/* ---------- 5. Đối chiếu: ứng viên evidence nào KHÔNG có trong docs ---------- */
function isDocumented(candidate, docText) {
  const words = (candidate.toLowerCase().match(/[a-zà-ỹ][a-z0-9à-ỹ]{2,}/g) || []).filter((w) => !STOP.has(w));
  if (!words.length) return true; // không có từ ý nghĩa → bỏ qua (coi như đã cover)
  const hit = words.filter((w) => docText.includes(w)).length;
  return hit / words.length >= 0.5; // >=50% từ ý nghĩa xuất hiện trong docs
}

const evidence = { generatedAt: new Date().toISOString(), routes: {} };
let totalUndoc = 0;
for (const page of routePages) {
  const route = routeOf(page);
  const files = graphFor(page);
  const agg = { labels: new Set(), headings: new Set(), comments: new Set(), components: new Set() };
  for (const f of files) {
    const e = extractFile(f); if (!e) continue;
    e.labels.forEach((x) => agg.labels.add(x));
    e.headings.forEach((x) => agg.headings.add(x));
    e.comments.forEach((x) => agg.comments.add(x));
    e.components.forEach((x) => agg.components.add(x));
  }
  const docText = docByRoute[route] || '';
  const cand = [...new Set([...agg.headings, ...agg.labels])];
  const undocumented = docText
    ? cand.filter((c) => !isDocumented(c, docText)).sort((a, b) => a.localeCompare(b))
    : cand; // route chưa có entry docs → tất cả là ứng viên
  evidence.routes[route] = {
    files: files.map((f) => norm(f).split('/apps/app/src/')[1]).filter(Boolean),
    components: [...agg.components].sort(),
    headings: [...agg.headings].sort(),
    labels: [...agg.labels].sort(),
    comments: [...agg.comments].sort(),
    hasDoc: !!docText,
    undocumented,
  };
  totalUndoc += undocumented.length;
}

writeFileSync(join(HERE, 'evidence.json'), JSON.stringify(evidence, null, 2));

/* ---------- 6. Báo cáo ---------- */
const routes = Object.keys(evidence.routes).sort();
console.log(`✓ Đã quét ${routePages.length} route → evidence.json`);
console.log(`\n📋 Ứng viên CÓ trong code nhưng CHƯA thấy trong data.js (cần cân nhắc bổ sung):\n`);
let shown = 0;
for (const rt of routes) {
  const u = evidence.routes[rt].undocumented;
  if (!u.length) continue;
  shown++;
  console.log(`  ${rt}  (${u.length})`);
  u.slice(0, 12).forEach((c) => console.log('     • ' + c));
  if (u.length > 12) console.log(`     … +${u.length - 12} nữa (xem evidence.json)`);
}
if (!shown) console.log('  ✓ Không có ứng viên nào — docs đã phủ mọi nhãn UI trích được.');
console.log(`\nTổng: ${totalUndoc} ứng viên trên ${shown} route. Đây là gợi ý — lọc thủ công vì có thể lẫn nhiễu (mock label, nhãn kỹ thuật).`);
