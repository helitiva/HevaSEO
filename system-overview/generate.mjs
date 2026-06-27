#!/usr/bin/env node
/**
 * generate.mjs — quét repo và tính lại các số liệu cấu trúc cho dashboard tổng quan.
 *
 * Chạy:  node system-overview/generate.mjs
 * Kết quả: ghi đè system-overview/metrics.js (window.HEVA_METRICS).
 *
 * Mục tiêu: trạng thái/metric trên trang luôn phản ánh code mới nhất — chạy lại
 * script này sau mỗi thay đổi là dashboard cập nhật. Phần nội dung định tính
 * (mô tả tính năng, roadmap) nằm tay trong data.js; phần đếm được nằm ở đây.
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const APP = join(ROOT, 'apps', 'app', 'src');

/** Liệt kê file đệ quy theo điều kiện. */
function walk(dir, pred, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
      walk(full, pred, out);
    } else if (pred(full)) {
      out.push(full);
    }
  }
  return out;
}

const isPage = (p) => p.endsWith('page.tsx');
const isComponent = (p) => p.endsWith('.tsx');

const allPages = walk(join(APP, 'app'), isPage);
const norm = (p) => p.replaceAll('\\', '/');
const count = (re) => allPages.filter((p) => re.test(norm(p))).length;

// Route theo từng bề mặt (vai trò).
const portal = count(/\/app\/\(portal\)\//);
const staff = count(/\/app\/staff\//);
const adminAll = count(/\/app\/admin\//);
const totalRoutes = allPages.length;

// Component .tsx trong src/components.
const components = walk(join(APP, 'components'), isComponent).length;

// Type/interface khai báo trong data layer.
const dataFiles = walk(join(APP, 'data'), (p) => p.endsWith('.ts'));
let dataTypes = 0;
for (const f of dataFiles) {
  const txt = readFileSync(f, 'utf8');
  dataTypes += (txt.match(/export\s+(interface|type)\s/g) || []).length;
}

// Dịch vụ orderable trong catalog — mỗi entry SERVICE_CATALOG có đúng 1 `orderCode:`.
let services = 0;
try {
  const svc = readFileSync(join(APP, 'data', 'services.ts'), 'utf8');
  services = (svc.match(/orderCode:\s*['"]/g) || []).length;
} catch { services = 7; }

// Spec docs.
const specs = walk(join(ROOT, 'docs', 'superpowers', 'specs'), (p) => p.endsWith('.md')).length;
const plans = walk(join(ROOT, 'docs', 'superpowers', 'plans'), (p) => p.endsWith('.md')).length;

// ── Coverage audit: route trong CODE vs route đã ghi trong data.js ─────
// Mục tiêu: không bao giờ bỏ sót màn hình mới trong im lặng. Mỗi lần build,
// script đối chiếu và in cảnh báo nếu có route chưa được tài liệu hóa
// (hoặc route đã ghi nhưng không còn tồn tại trong code).
function routeOf(p) {
  const after = norm(p).split('/app/src/app/')[1] || '';
  const rel = after.replace(/\/page\.tsx$/, '').replace(/^page\.tsx$/, '');
  const segs = rel.split('/').filter((s) => s && !/^\(.*\)$/.test(s)); // bỏ route-group (portal)
  return '/' + segs.join('/');
}
// Bỏ trang redirect-only (vd app/page.tsx chỉ redirect('/dashboard')) — không phải màn hình thật.
const isRedirectStub = (p) => {
  try { const t = readFileSync(p, 'utf8'); return /redirect\(/.test(t) && !/return\s*\(/.test(t); }
  catch { return false; }
};
const codeRoutes = [...new Set(allPages.filter((p) => !isRedirectStub(p)).map(routeOf))].sort();

const dataTxt = readFileSync(join(HERE, 'data.js'), 'utf8');
const docRoutes = [...new Set(
  [...dataTxt.matchAll(/route:\s*'([^']+)'/g)]
    .map((m) => m[1])
    .filter((r) => r.startsWith('/') && !r.includes('*')),
)].sort();

const missing = codeRoutes.filter((r) => !docRoutes.includes(r)); // có code, thiếu mô tả
const orphan = docRoutes.filter((r) => !codeRoutes.includes(r));  // đã ghi, không còn trong code
const documentedInCode = codeRoutes.length - missing.length;
const coveragePct = codeRoutes.length ? Math.round((documentedInCode / codeRoutes.length) * 100) : 100;

const metrics = {
  generatedAt: new Date().toISOString(),
  routes: { portal, staff, admin: adminAll, total: totalRoutes },
  components,
  dataTypes,
  services,
  docs: { specs, plans },
  roles: 4,
  coverage: { codeRoutes: codeRoutes.length, documented: documentedInCode, pct: coveragePct, missing, orphan },
};

const banner = '/* AUTO-GENERATED bởi generate.mjs — đừng sửa tay. Chạy: node system-overview/generate.mjs */\n';
const metricsJs = banner + 'window.HEVA_METRICS = ' + JSON.stringify(metrics, null, 2) + ';\n';
writeFileSync(join(HERE, 'metrics.js'), metricsJs);

// ── Build self-contained index.html (inline CSS + JS) ──────────────────
// Mở index.html ở bất kỳ đâu (file://, trình xem nghiêm ngặt, offline) đều chạy —
// không phụ thuộc nạp file rời. Nguồn sửa tay: index.template.html, styles.css, data.js, app.js.
const css = readFileSync(join(HERE, 'styles.css'), 'utf8');
const dataJs = readFileSync(join(HERE, 'data.js'), 'utf8');
const appJs = readFileSync(join(HERE, 'app.js'), 'utf8');
let html = readFileSync(join(HERE, 'index.template.html'), 'utf8');

html = html.replace(
  '<link rel="stylesheet" href="styles.css" />',
  '<style>\n' + css + '\n</style>',
);
html = html.replace(
  /\s*<script src="metrics\.js"><\/script>\s*<script src="data\.js"><\/script>\s*<script src="app\.js"><\/script>/,
  '\n  <script>\n' + metricsJs + '\n' + dataJs + '\n' + appJs + '\n  </script>',
);
writeFileSync(join(HERE, 'index.html'), html);

console.log('✓ metrics:', JSON.stringify(metrics.routes), `· ${components} components · ${dataTypes} types · ${services} services`);
console.log('✓ index.html self-contained đã build (' + Math.round(html.length / 1024) + ' KB)');

// ── In báo cáo coverage (zero-prompt: chạy build là biết ngay) ─────────
console.log(`\n📋 Coverage tính năng: ${documentedInCode}/${codeRoutes.length} route đã có mô tả (${coveragePct}%)`);
if (missing.length) {
  console.log(`\n⚠️  ${missing.length} ROUTE TRONG CODE CHƯA CÓ MÔ TẢ trong data.js (cần bổ sung tier1/tier2):`);
  missing.forEach((r) => console.log('   • ' + r));
} else {
  console.log('   ✓ Mọi route trong code đều đã được tài liệu hóa.');
}
if (orphan.length) {
  console.log(`\nℹ️  ${orphan.length} route đã ghi trong data.js nhưng KHÔNG thấy trong code (planned, hoặc đã đổi đường dẫn):`);
  orphan.forEach((r) => console.log('   • ' + r));
}
