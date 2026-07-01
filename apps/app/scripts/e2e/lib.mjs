// Shared harness for the feature-organized live E2E suite. Drives the REAL local stack (Supabase Auth +
// RLS + SECURITY DEFINER fns) exactly as a browser client would. Run against a pristine seed:
//   pnpm db:reset && docker restart supabase_kong_hevaseo-platform
//   J=$(pnpm exec supabase status -o json)
//   SMOKE_URL=http://127.0.0.1:54321 SMOKE_ANON=<anon> SMOKE_SVC=<service> node apps/app/scripts/e2e/run.mjs
import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSvc } from '@supabase/supabase-js';

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error(`This suite needs Node >= 22 (found ${process.versions.node}). Use: nvm use 22`);
  process.exit(2);
}

export const URL = process.env.SMOKE_URL || 'http://127.0.0.1:54321';
export const ANON = process.env.SMOKE_ANON;
const SVC_KEY = process.env.SMOKE_SVC;
if (!ANON || !SVC_KEY) { console.error('Set SMOKE_ANON and SMOKE_SVC (from `supabase status -o json`).'); process.exit(2); }

// ── seed constants (pristine seed.sql) ──
export const AGENCY = 'a9e0c0de-0000-4000-8000-000000000001';
export const ACME = 'c0000000-0000-4000-8000-000000000001';   // Jane's customer (claimed)
export const MAI = 'b000aaaa-0000-4000-8000-000000000003';    // staff profile id
export const SOFIA = 'b000aaaa-0000-4000-8000-000000000002';  // manager profile id
export const ACCOUNTS = {
  admin: 'admin@hevaseo.com', manager: 'sofia@hevaseo.com', staff: 'mai@hevaseo.com',
  customer: 'jane@acme.com', affiliate: 'jane@janeseo.com',
};

// ── clients ──
export const svc = createSvc(URL, SVC_KEY, { auth: { persistSession: false } });
const mkSess = () => {
  const jar = new Map();
  return createBrowserClient(URL, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
};
export const anonClient = () => mkSess();
export async function login(email, password = 'demo1234') {
  const s = mkSess();
  const { error } = await s.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return s;
}
export async function roleOf(s) {
  const { data } = await s.auth.getSession();
  const t = data.session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(t, 'base64')).app_role;
}
export const uniqEmail = (tag) => `e2e.${tag}.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@e2e.test`;

// ── tiny test registry ──
let pass = 0, fail = 0;
const failures = [];
const G = '\x1b[32m', R = '\x1b[31m', B = '\x1b[1m', X = '\x1b[0m';
export function group(title) { console.log(`\n${B}== ${title} ==${X}`); }
export async function check(name, fn) {
  try { await fn(); console.log(`  ${G}PASS${X}  ${name}`); pass++; }
  catch (e) { console.log(`  ${R}FAIL${X}  ${name} — ${e.message}`); fail++; failures.push(name); }
}
export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
export function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
// a Supabase call ({data,error}) that MUST be denied/error (RLS or authz)
export async function denied(call, label) { const { error } = await call; if (!error) throw new Error(`${label}: expected denial, but it succeeded`); }
// a Supabase call that MUST succeed
export async function allowed(call, label) { const { data, error } = await call; if (error) throw new Error(`${label}: ${error.message}`); return data; }
// an RLS SELECT that must return exactly N rows
export async function rows(call, label) { const { data, error } = await call; if (error) throw new Error(`${label}: ${error.message}`); return data ?? []; }
export function report() {
  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (failures.length) console.log('Failed:\n  - ' + failures.join('\n  - '));
  return fail;
}
