# HevaSEO Backend — Testing Reference

Test layers, tooling, fixtures, per-phase gate commands, and coverage targets for the
HevaSEO Supabase backend. Read `ARCHITECTURE.md` first to understand the code layout,
then use this file to know what to test and how.

---

## 1. Test Layers

There are four independent test layers. Each targets a different failure mode; all four
must be green before a phase may commit.

| Layer | What fails without it | Tooling | When to run |
|---|---|---|---|
| A — Schema constraints | Silent data corruption: wrong types, missing FKs, float money | `pgTAP` in `supabase start` container | Phase B1 gate |
| B — RLS per-role | Wrong data leaks: manager sees money, staff sees other staff finance | `pgTAP` or vitest integration against local Supabase | Phase B2 gate (and re-run every B phase) |
| C — Query / builder unit | Mock-to-DB cutover breaks page shape | `vitest` unit tests | Per domain, B4–B9 gates |
| D — Critical-flow E2E | Integrated flows break end to end | Playwright | B10 gate (and smoke per release) |

---

## 2. Layer A — Schema Constraint Tests

**Goal:** prove the migration DDL actually enforces the invariants in `SCHEMA.md`.

**Tooling:** [pgTAP](https://pgtap.org/) SQL test functions run inside the `supabase start`
Postgres container. Add them to `supabase/tests/schema/`.

**What to test per table:**

```sql
-- supabase/tests/schema/test_money.sql
BEGIN;
SELECT plan(6);

-- numeric(12,2), not float
SELECT col_type_is('public', 'orders',           'value',    'numeric', 'orders.value is numeric');
SELECT col_type_is('public', 'payroll_records',  'base',     'numeric', 'payroll base is numeric');
SELECT col_type_is('public', 'staff_penalties',  'amount',   'numeric', 'penalty amount is numeric');

-- CHECK constraints
SELECT throws_ok(
  $$ INSERT INTO orders(id,code,customer_id,service_id,pkg,value,status,priority,source)
     VALUES('x','X-001','c1','backlink','Growth',-1,'new','med','dashboard') $$,
  '23514', 'orders.value must be non-negative'
);
SELECT throws_ok(
  $$ INSERT INTO staff_penalties(id,staff_id,type,reason,sizing,amount)
     VALUES('p1','s1','manual','test','flat',-5) $$,
  '23514', 'penalty amount must be non-negative'
);

-- NOT NULL
SELECT col_not_null('public', 'payroll_records', 'period_month', 'period_month is NOT NULL');

SELECT finish();
ROLLBACK;
```

**Run:**
```bash
supabase test db                    # runs all SQL test files in supabase/tests/
# or target a single file:
psql "$DATABASE_URL" -f supabase/tests/schema/test_money.sql
```

> **Implemented pgTAP** (run via `pnpm verify:db`, 240 tests green): money-blind reads `0260_order_addons` + `0270_invoices` (admin/customer see, manager/staff 0 rows); `0280_fn_materialize_order` (quick-checkout atomicity — balance nets to 0, `balance == SUM(ledger)`, idempotent replay returns the same order, distinct ref → new order, service-role-only). **Quick-checkout was also browser-verified e2e** (marketing form → pay → account + order; new account login works; billing persisted) — see FEATURES §4.6.

**Minimum assertions per domain:**
- All money columns are `numeric`, not `float8` / `double precision`
- All `CHECK` constraints from `SCHEMA.md` (non-negative amounts, positive counts, period
  format regex, singleton constraints on `program_rules`, `settings_routing`, etc.)
- All required `NOT NULL` columns
- All FK relationships
- Enum values reject out-of-range literals

---

## 3. Layer B — RLS Per-Role Tests

**Goal:** prove that each role sees exactly and only what `RLS.md §4` (the per-role test
matrix) says it should see. Failures here are **CRITICAL** blockers.

### 3.1 Approach

Run vitest integration tests against a **live `supabase start` local instance**. Each test:

1. Seeds the local DB with the fixtures from §4.
2. Mints a role-scoped Supabase client using a test JWT (§3.3).
3. Issues the query under test.
4. Asserts the row set / column values match the matrix.

This is the most important test suite in the project. RLS tests do not mock anything —
they exercise the actual Postgres policies.

```typescript
// supabase/tests/rls/orders.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { mintTestJwt } from '../helpers/jwt';
import { FIXTURES } from '../helpers/fixtures';

const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? 'http://localhost:54321';
const ANON_KEY     = process.env.SUPABASE_TEST_ANON_KEY ?? '<local anon key>';

function roleClient(role: string, claims: Record<string, string>) {
  const jwt = mintTestJwt({ sub: claims.userId, role, ...claims });
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

describe('orders RLS matrix', () => {
  it('admin sees all orders', async () => {
    const db = roleClient('admin', { userId: FIXTURES.admin.userId });
    const { data } = await db.from('orders').select('id');
    expect(data?.length).toBe(FIXTURES.orderCount);
  });

  it('manager sees only pod orders (pod = mgr1)', async () => {
    const db = roleClient('manager', {
      userId:    FIXTURES.mgr1.userId,
      entity_id: 'mgr1',
      pod_id:    'mgr1',
    });
    const { data } = await db.from('orders').select('id');
    const podOrderIds = FIXTURES.ordersByPod('mgr1').map(o => o.id);
    expect(data?.map(r => r.id).sort()).toEqual(podOrderIds.sort());
  });

  it('manager sees orders_manager view — value column is NULL', async () => {
    const db = roleClient('manager', {
      userId: FIXTURES.mgr1.userId, entity_id: 'mgr1', pod_id: 'mgr1',
    });
    const { data } = await db.from('orders_manager').select('id, value').limit(1);
    expect(data?.[0]?.value).toBeNull();
  });

  it('staff sees only own assigned orders', async () => {
    const db = roleClient('staff', {
      userId: FIXTURES.s1.userId, entity_id: 's1', pod_id: 'mgr1',
    });
    const { data } = await db.from('orders').select('id');
    const ownOrderIds = FIXTURES.ordersByStaff('s1').map(o => o.id);
    expect(data?.map(r => r.id).sort()).toEqual(ownOrderIds.sort());
  });

  it('staff cannot see another staff member\'s orders', async () => {
    const db = roleClient('staff', {
      userId: FIXTURES.s2.userId, entity_id: 's2', pod_id: 'mgr1',
    });
    // s2 has no orders in fixtures
    const { data } = await db.from('orders').select('id').eq('staff_id', 's1');
    expect(data?.length).toBe(0);
  });

  it('customer sees only own orders', async () => {
    const db = roleClient('customer', {
      userId: FIXTURES.c1.userId, entity_id: 'c1',
    });
    const { data } = await db.from('orders').select('id');
    const ownOrderIds = FIXTURES.ordersByCustomer('c1').map(o => o.id);
    expect(data?.map(r => r.id).sort()).toEqual(ownOrderIds.sort());
  });

  it('affiliate sees 0 orders', async () => {
    const db = roleClient('affiliate', {
      userId: FIXTURES.af1.userId, entity_id: 'af-jane',
    });
    const { data } = await db.from('orders').select('id');
    expect(data?.length).toBe(0);
  });
});
```

### 3.2 Money-Blind and Own-Finance Tests (Never Skip)

These two invariants are in the **"never ship untested"** category (see §7):

```typescript
describe('manager money-blind', () => {
  it('manager has zero rows on payroll_records', async () => {
    const db = roleClient('manager', { … });
    const { data, error } = await db.from('payroll_records').select('*');
    // RLS: no manager SELECT policy → 0 rows or empty (not an error)
    expect(data?.length ?? 0).toBe(0);
  });

  it('manager has zero rows on transactions', async () => { … });
  it('manager has zero rows on staff_penalties', async () => { … });
  it('manager has zero rows on staff_payout_requests', async () => { … });
  it('manager sees NULL spend/balance in customers_manager view', async () => {
    const db = roleClient('manager', { … });
    const { data } = await db.from('customers_manager').select('spend, balance').limit(1);
    expect(data?.[0]?.spend).toBeNull();
    expect(data?.[0]?.balance).toBeNull();
  });
});

describe('staff own-finance', () => {
  it('staff sees only their own payroll_records', async () => {
    const db = roleClient('staff', { entity_id: 's1', … });
    const { data } = await db.from('payroll_records').select('staff_id');
    expect(data?.every(r => r.staff_id === 's1')).toBe(true);
  });

  it('staff cannot read another staff member\'s penalties', async () => {
    const db = roleClient('staff', { entity_id: 's2', … });
    const { data } = await db.from('staff_penalties').select('id').eq('staff_id', 's1');
    expect(data?.length).toBe(0);
  });

  it('manager has zero rows on payroll_records for any staff member', async () => {
    const db = roleClient('manager', { entity_id: 'mgr1', pod_id: 'mgr1', … });
    const { data } = await db.from('payroll_records').select('*');
    expect(data?.length ?? 0).toBe(0);
  });
});
```

### 3.3 Minting Test JWTs

Local Supabase (`supabase start`) exposes a JWT secret in `supabase/.env.local` or via
`supabase status`. Use it to sign test tokens with exactly the same claims the real JWT
hook produces:

```typescript
// supabase/tests/helpers/jwt.ts
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET!;

export async function mintTestJwt(claims: {
  sub: string;
  role: string;
  entity_id?: string;
  pod_id?: string;
  aud?: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({
    sub:       claims.sub,
    role:      claims.role,           // custom claim read by current_heva_role()
    entity_id: claims.entity_id,      // read by current_entity_id()
    pod_id:    claims.pod_id,         // read by current_pod()
    aud:       claims.aud ?? 'authenticated',
    iss:       'supabase',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
}
```

> **Important:** Supabase RLS reads custom claims from the JWT's top-level payload (not
> `app_metadata`). The custom access token hook in `RLS.md §1.1` injects `role`,
> `entity_id`, and `pod_id` at the top level via `jsonb_set(claims, '{role}', …)`. Test
> JWTs must place these at the top level too or policies will silently misread them.

### 3.4 Full RLS Test Matrix Mapping

Every row in `RLS.md §4` must have a corresponding test. Cross-reference:

| Matrix row | Test file | Test name pattern |
|---|---|---|
| `orders SELECT admin allow (all)` | `rls/orders.test.ts` | `admin sees all orders` |
| `orders SELECT manager allow (pod)` | `rls/orders.test.ts` | `manager sees only pod orders` |
| `orders.value col manager redacted` | `rls/orders.test.ts` | `manager sees orders_manager view — value is NULL` |
| `payroll_records SELECT manager deny` | `rls/finance.test.ts` | `manager has zero rows on payroll_records` |
| `staff_penalties SELECT staff (own) allow` | `rls/finance.test.ts` | `staff sees only their own penalties` |
| `staff_penalties SELECT manager deny` | `rls/finance.test.ts` | `manager has zero rows on staff_penalties` |
| `notes ALL admin allow (self only)` | `rls/notes.test.ts` | `admin sees only their own notes` |
| … | … | … |

---

## 4. Layer C — Query / Builder Unit Tests

**Goal:** prove the `server/queries/*` functions return the same shape the frontend page
expects after the mock body is replaced with a real DB query.

**Tooling:** vitest, run against a seeded local Supabase (`supabase start` + seed applied).
These tests call the actual exported functions, not mocked Supabase clients.

```typescript
// apps/app/src/server/queries/orders.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { buildOrderDetailProps } from './orders';

// These tests require supabase start + seed.sql to be applied.
// In CI this is done by the supabase-boot job before running vitest.

describe('buildOrderDetailProps', () => {
  it('returns null for unknown id', async () => {
    const result = await buildOrderDetailProps('nonexistent-id');
    expect(result).toBeNull();
  });

  it('returns OrderDetailProps for a known order id', async () => {
    const result = await buildOrderDetailProps('o1');
    expect(result).not.toBeNull();
    expect(result?.code).toMatch(/^AUD-/);
    expect(result?.customer.name).toBeDefined();
    expect(result?.briefFields.every(f => typeof f.label === 'string')).toBe(true);
  });

  it('does not include value field when called as manager client', async () => {
    // This test runs as a manager session to confirm the view is selected
    // and value is redacted. Achieved by setting up a manager auth context
    // in the test environment before calling the function.
    // Implementation detail: builder checks session role and selects
    // orders vs orders_manager accordingly.
    const result = await buildOrderDetailPropsAsManager('o1');
    expect((result as any)?.value).toBeNull();
  });
});
```

**What to test per domain:**

| Domain | Functions to cover | Key assertions |
|---|---|---|
| Orders / Catalog | `buildOrderDetailProps`, `packagePrice`, `servicePriceRange` | Shape matches `OrderDetailProps`; null on not-found |
| Staff Work | `currentStaffId`, `currentStaffIdentity`, `buildStaffInsight` | Returns `StaffInsight` with ~30 required fields |
| Finance / Payroll | `staffPaySeed`, `buildPayrollPeriods`, `currentPenalties` | `due = base + gig + commission + bonus` (generated col); period format `YYYY-MM` |
| Affiliate | `portalDataFor` | Returns `PortalData`; referrals + events + payouts arrays present |
| Manager | `managerScope`, `buildManagerPerf` | Pod arrays contain only the manager's staff |
| Docs | `docsForStaff`, `docsForManager`, `docsForCustomer` | Audience filter enforced; no cross-audience leakage |
| Broadcasts | `broadcastsForAudience`, `unreadCount` | Only active, non-expired, correct-audience broadcasts |

**Pure math functions** (`effectivePay`, `buildLedger`, `tierFor`, `summarisePenalties`,
`walletBalance`, etc.) are tested in their existing `lib/*.test.ts` vitest unit tests with
hardcoded inputs — no DB or Supabase client required. These tests are already in the repo
and must stay green throughout every phase.

---

## 5. Layer D — Critical-Flow E2E Tests

**Goal:** prove that the most business-critical multi-step flows work end-to-end: data
enters the DB, RLS holds at every step, and the page renders correctly.

**Tooling:** Playwright against a locally running `next dev` connected to `supabase start`.

**Critical flows to cover (minimum set for B10 gate):**

### Flow 1: Order → Deliver → Review → Pay

```typescript
// e2e/flows/order-lifecycle.spec.ts
import { test, expect } from '@playwright/test';

test('admin places order → assigns → staff submits deliverable → admin approves → payroll reflects gig', async ({ page, context }) => {
  // 1. Admin places order
  await page.goto('/admin/orders');
  // … fill quick-order form …

  // 2. Admin assigns to staff s1
  // 3. Staff (impersonated) starts task, submits deliverable
  // 4. Admin reviews + approves
  // 5. Admin runs payroll for current month → gig count increases by 1
  // 6. Verify staff payroll record: gig column > 0
});
```

### Flow 2: Affiliate Referral → Commission → Payout

```typescript
// e2e/flows/affiliate-commission.spec.ts
test('affiliate referral converts to commission event → payout request → admin marks paid', async ({ page }) => {
  // 1. Customer signs up via affiliate link (referrer_id set)
  // 2. Customer places order → commission_events row created
  // 3. Affiliate requests payout (amount = unclaimed)
  // 4. Admin approves payout → affiliate_payout_requests.status = 'paid'
  // 5. Affiliate dashboard shows unclaimed = 0
});
```

### Flow 3: Manager Cannot See Money (money-blind E2E)

```typescript
// e2e/rls/manager-money-blind.spec.ts
test('manager portal shows no monetary figures', async ({ page }) => {
  await page.goto('/manager/orders');
  // No element on the page should contain a $ figure from order.value
  // Playwright: assert that all text matching /\$\d/ is absent
  const moneyText = page.getByText(/\$\d/);
  await expect(moneyText).toHaveCount(0);
});
```

### Flow 4: Staff Finance Self-Service

```typescript
// e2e/flows/staff-payout.spec.ts
test('staff requests payout → admin approves → wallet balance decreases', async ({ page }) => {
  // 1. Staff navigates to /staff/finance
  // 2. Wallet balance > 0 (seeded)
  // 3. Staff requests payout
  // 4. Admin approves → staff_payout_requests.status = 'approved'
  // 5. Staff refreshes → balance shows pending deduction
});
```

---

## 6. Fixtures and Seeding

### 6.1 Seed file (`supabase/seed.sql`)

`seed.sql` inserts a deterministic set of rows that mirrors the Phase-0 mock data
(`adminMock.ts`, `staffMock.ts`, etc.). This gives RLS tests a predictable set of row IDs
to assert against.

Minimum seed contents per role for RLS testing:

| Entity | Seed rows |
|---|---|
| `users` | 1 admin, 1 manager (mgr1), 2 staff (s1 ∈ pod-mgr1, s2 ∈ pod-mgr1), 1 staff in a different pod (s3 ∈ pod-mgr2), 1 customer (c1), 1 affiliate (af-jane) |
| `managers` | mgr1, mgr2 (separate pods) |
| `staff` | s1 (manager_id=mgr1), s2 (manager_id=mgr1), s3 (manager_id=mgr2) |
| `orders` | o1 (staff_id=s1, customer_id=c1), o2 (staff_id=s2), o3 (staff_id=s3), o4 (staff_id=NULL — unassigned) |
| `payroll_records` | 1 row for s1 (period_month='2026-06') |
| `staff_penalties` | 1 row for s1 |
| `affiliates` | af-jane (user_id = af-jane user's UUID) |
| `commission_events` | 1 event for af-jane |

Seed users also need corresponding rows in `auth.users`. Use Supabase CLI's seed helper or
insert directly:

```sql
-- In seed.sql (runs as service-role; bypasses RLS)
INSERT INTO auth.users(id, email, raw_user_meta_data)
  VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@hevaseo.com', '{"role":"admin"}'),
    ('00000000-0000-0000-0000-000000000002', 'mgr1@hevaseo.com',  '{"role":"manager"}'),
    …
ON CONFLICT DO NOTHING;

INSERT INTO public.users(id, email, name, role, status)
  VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@hevaseo.com', 'Admin', 'admin', 'active'),
    ('00000000-0000-0000-0000-000000000002', 'mgr1@hevaseo.com',  'Manager One', 'manager', 'active'),
    …
ON CONFLICT DO NOTHING;
```

### 6.2 Test helpers

```typescript
// supabase/tests/helpers/fixtures.ts
export const FIXTURES = {
  admin:      { userId: '00000000-0000-0000-0000-000000000001' },
  mgr1:       { userId: '00000000-0000-0000-0000-000000000002', entityId: 'mgr1' },
  mgr2:       { userId: '00000000-0000-0000-0000-000000000007', entityId: 'mgr2' },
  s1:         { userId: '00000000-0000-0000-0000-000000000003', entityId: 's1', pod: 'mgr1' },
  s2:         { userId: '00000000-0000-0000-0000-000000000004', entityId: 's2', pod: 'mgr1' },
  s3:         { userId: '00000000-0000-0000-0000-000000000005', entityId: 's3', pod: 'mgr2' },
  c1:         { userId: '00000000-0000-0000-0000-000000000006', entityId: 'c1' },
  af1:        { userId: '00000000-0000-0000-0000-000000000008', entityId: 'af-jane' },
  orderCount: 4,
  ordersByPod: (podId: string) => podId === 'mgr1' ? [{ id: 'o1' }, { id: 'o2' }, { id: 'o4' }] : [],
  ordersByStaff: (staffId: string) => staffId === 's1' ? [{ id: 'o1' }] : [],
  ordersByCustomer: (customerId: string) => customerId === 'c1' ? [{ id: 'o1' }] : [],
};
```

---

## 7. Phase-Gate Mapping (Definition of Done → runnable commands)

Each PLAN.md phase gate is satisfied by these concrete commands:

### B0 — Foundation

```bash
supabase start                              # local instance starts without errors
supabase db push                            # smoke migration applies clean
pnpm --filter @heva/app exec tsc --noEmit  # helpers typecheck
```

### B1 — Schema

```bash
supabase db reset                           # migrations replay cleanly
supabase test db                            # schema constraint tests (pgTAP) all green
pnpm --filter @heva/app test -- --reporter verbose   # existing 339 frontend tests still green
```

### B2 — Auth + RLS Foundation

```bash
supabase db reset
supabase test db                            # schema tests still green
pnpm vitest run supabase/tests/rls/         # ALL RLS per-role tests green
# Manually verify:
#   - manager query on payroll_records returns 0 rows
#   - manager query on orders_manager returns value = NULL
#   - staff query on payroll_records returns only own rows
pnpm --filter @heva/app exec tsc --noEmit  # no new type errors
```

### B3 — Seed

```bash
supabase db reset                           # migrations + seed apply cleanly
# Spot-check: query a seeded order, staff, customer via psql or Supabase Studio
# Frontend: pnpm dev → order list renders (still from mock; seed is for DB layer only)
pnpm --filter @heva/app test               # all frontend tests still green
```

### B4 — Orders & Catalog

```bash
pnpm vitest run supabase/tests/rls/orders.test.ts supabase/tests/rls/catalog.test.ts
pnpm vitest run apps/app/src/server/queries/orders.test.ts
pnpm --filter @heva/app test               # frontend tests including rbac.test.ts green
# Manual: navigate /admin/orders → list loads from DB; order detail page matches mock shape
pnpm --filter @heva/app exec tsc --noEmit
```

### B5 — Staff Work

```bash
pnpm vitest run supabase/tests/rls/staff.test.ts supabase/tests/rls/deliverables.test.ts
pnpm vitest run apps/app/src/server/queries/staff.test.ts
pnpm --filter @heva/app test
pnpm --filter @heva/app exec tsc --noEmit
```

### B6 — Finance & Payroll

```bash
# Must run finance RLS tests first — these are CRITICAL
pnpm vitest run supabase/tests/rls/finance.test.ts
# Assert all money-blind tests pass before proceeding

pnpm vitest run apps/app/src/server/queries/finance.test.ts
pnpm --filter @heva/app test
pnpm --filter @heva/app exec tsc --noEmit
# Manual: payroll explorer + staff /finance reconcile to net = due − applied penalties
```

### B7 — Affiliate

```bash
pnpm vitest run supabase/tests/rls/affiliate.test.ts
pnpm vitest run apps/app/src/server/queries/affiliate.test.ts
pnpm --filter @heva/app test
pnpm --filter @heva/app exec tsc --noEmit
```

### B8 — Messaging & Content

```bash
pnpm vitest run supabase/tests/rls/broadcasts.test.ts supabase/tests/rls/docs.test.ts supabase/tests/rls/notes.test.ts
pnpm vitest run apps/app/src/server/queries/broadcasts.test.ts apps/app/src/server/queries/docs.test.ts
pnpm --filter @heva/app test
pnpm --filter @heva/app exec tsc --noEmit
```

### B9 — Tickets, Audit, Settings, Analytics

```bash
pnpm vitest run supabase/tests/rls/tickets.test.ts supabase/tests/rls/audit.test.ts
pnpm vitest run apps/app/src/server/queries/tickets.test.ts
pnpm --filter @heva/app test
pnpm --filter @heva/app exec tsc --noEmit
```

### B10 — Hardening (full gate)

```bash
supabase db reset
supabase test db                            # all pgTAP schema tests
pnpm vitest run supabase/tests/rls/         # all RLS tests
pnpm --filter @heva/app test               # all vitest unit tests (≥80% coverage)
pnpm --filter @heva/app exec playwright test e2e/flows/    # critical-flow E2E
pnpm --filter @heva/app exec playwright test e2e/rls/      # money-blind E2E
pnpm --filter @heva/app build              # production build is clean
```

---

## 8. Coverage Target

**New backend code must reach ≥ 80% line coverage measured by vitest.**

```bash
# Run with coverage (from apps/app):
pnpm vitest run --coverage

# vitest.config.ts coverage config:
coverage: {
  provider: 'v8',
  include: ['src/server/**/*.ts', 'src/lib/**/*.ts'],
  exclude: ['src/server/**/*.test.ts', 'src/data/**'],
  thresholds: { lines: 80, functions: 80, branches: 80 },
}
```

### What must never ship untested

These functions and invariants carry a mandatory test requirement regardless of coverage
thresholds:

| Concern | Why mandatory | Where tested |
|---|---|---|
| Payroll formula: `due = base + gig + commission + bonus` | Money computation — wrong output corrupts staff pay | Schema layer B (generated column test) + query layer C |
| `net = due − Σ applied_penalties` reconciliation | Same reason; penalties are applied at read-time | Query layer C: `buildLedger` shape test |
| Manager sees 0 rows on all finance tables | CRITICAL — money-blind invariant | RLS layer B: `finance.test.ts` |
| Manager sees NULL for `value`, `spend`, `balance`, `gig_rate` | CRITICAL — column redaction | RLS layer B: view tests |
| Staff sees only own `payroll_records`, `staff_penalties`, `staff_payout_requests` | CRITICAL — own-finance boundary | RLS layer B: `finance.test.ts` |
| `commission_events.ce_order_consistency` CHECK enforced | Data integrity: exactly one of order_id / external_order | Schema layer A: pgTAP |
| Affiliate sees only own rows | Data isolation | RLS layer B: `affiliate.test.ts` |
| Service-role actions Zod-validate before executing | Injection prevention | Unit tests for each action with malformed input |

---

## 9. CI Wiring

Add a `backend-test` job that runs before the deploy job:

```yaml
# .github/workflows/ci.yml  (sketch)
jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm + Node
        uses: pnpm/action-setup@v3
        with: { version: 9 }

      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Boot Supabase
        uses: supabase/setup-cli@v1
        with: { version: latest }

      - name: Start local Supabase
        run: supabase start

      - name: Apply migrations + seed
        run: supabase db reset

      - name: Run schema constraint tests (pgTAP)
        run: supabase test db

      - name: Run RLS per-role tests
        run: pnpm vitest run supabase/tests/rls/
        env:
          SUPABASE_TEST_URL:          http://localhost:54321
          SUPABASE_TEST_ANON_KEY:     ${{ steps.supabase.outputs.anon-key }}
          SUPABASE_TEST_JWT_SECRET:   ${{ steps.supabase.outputs.jwt-secret }}

      - name: Run query unit tests (with coverage)
        run: pnpm --filter @heva/app vitest run --coverage
        env:
          NEXT_PUBLIC_SUPABASE_URL:    http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ steps.supabase.outputs.anon-key }}
          SUPABASE_SERVICE_ROLE_KEY:   ${{ steps.supabase.outputs.service-role-key }}

      - name: Run frontend tests (rbac.test.ts, etc.)
        run: pnpm --filter @heva/app test

      - name: Type check
        run: pnpm --filter @heva/app exec tsc --noEmit

      - name: Stop Supabase
        if: always()
        run: supabase stop

  deploy:
    needs: backend-test
    …
```

**Key CI constraints:**
- The `backend-test` job must complete green before `deploy` runs.
- Coverage enforcement (`thresholds`) causes the job to fail if new code drops below 80%.
- The RLS test step reads `SUPABASE_TEST_JWT_SECRET` from the Supabase CLI output — never
  hardcode the secret in the workflow file or in source code.
- The service-role key used in CI is the **local dev key** issued by `supabase start`,
  not the production key. Production keys are never present in CI.
