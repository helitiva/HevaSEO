# HevaSEO Backend — Build Runbook

The master guide a Claude Code session executes to build the HevaSEO backend **autonomously,
phase by phase, with TDD and gated commits**. Read this first, then the reference docs it points to.

> **How to run:** relaunch in bypass-permissions, say "build backend phase B<n>". Each phase is
> self-contained: write tests → implement → verify → commit → stop for review. Never skip the gate.

---

## 0. Locked architecture (do not re-litigate)
- **DB:** Supabase = managed **Postgres**. Relational core + **`jsonb`** for genuinely-flexible
  fields (intake form fields, `gigRates`/`gigPkgRates` maps, settings blobs, audit payloads).
- **Auth:** Supabase Auth (email/OTP). The user's **role** + (for staff/manager) **pod** + entity id
  ride in the JWT as custom claims; RLS reads them via `auth.jwt()`.
- **RBAC = RLS, source of truth.** Every access rule in `apps/app/src/lib/rbac.ts` is mirrored as a
  Postgres **Row-Level Security policy**. The DB is the deepest gate; the app never trusts the client.
  See [RLS.md](./RLS.md).
- **Storage:** Supabase Storage for deliverable files / attachments.
- **Frontend stays Next.js.** The backend is reached from Server Components / Server Actions /
  Route Handlers via the Supabase client. No separate API service.
- **Migrations:** Supabase CLI migrations (versioned SQL in `supabase/migrations/`, committed).

## 1. Prime directive — KEEP THE MOCK CONTRACT
The frontend already calls a clean data layer: builder functions in `apps/app/src/lib/*` and
`apps/app/src/data/*` (e.g. `buildOrderDetailProps(id)`, `portalDataFor(id)`, `effectivePay(seed)`,
`docsForStaff(...)`). **The backend swaps the *implementation* of these behind the *same
signatures*, one domain at a time.** A page should not change when its data goes from mock → DB.

For each domain you cut over:
1. Keep the exported function name + signature + return shape **identical**.
2. Replace the mock body with a Supabase query (server-side).
3. The mock types become the row/DTO types — reuse them.
4. If a signature must change, that's a frontend change → call it out, don't do it silently.

This makes the migration **incremental and reversible**: unconverted domains keep using mock data
while converted ones hit the DB. Ship value continuously, never a big-bang rewrite.

## 2. Principles
- **TDD, always.** Write the failing test first (RED) — schema constraint, RLS policy, or query
  builder — then implement (GREEN), then refactor. Target ≥80% on new backend code.
- **RLS-first security.** No table is exposed without a policy. Test every policy from **each role's**
  perspective (a manager query must return money-blind rows; a staffer sees only their own finance).
- **Money is sacred.** All currency = Postgres `numeric` (never float). Payroll/commission/payout
  mutations run in **transactions**. Reconcile against the documented formula:
  `net = base + gig + commission + bonus − penalties` (see [SCHEMA.md](./SCHEMA.md) payroll section).
- **Per-domain, gated.** One domain per phase. Each phase ends with a verify gate + a single commit
  + STOP for review. Clean rollback points.
- **Validate at the boundary.** Zod-parse every Server Action / Route Handler input before it
  touches the DB.

## 3. Reference docs (read the one a phase needs)
| Doc | Contents |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Project layout for backend code, env/secrets, Supabase client setup, error envelope, conventions, how Server Actions/Route Handlers wrap the data layer |
| [SCHEMA.md](./SCHEMA.md) | Concrete Postgres DDL for every entity (from `docs/DATA-MODEL.md`): tables, columns, types, enums, FKs, indexes, `jsonb` fields; resolved decisions (affiliate-as-role, external referred orders) |
| [RLS.md](./RLS.md) | `lib/rbac.ts` → RLS policy map, table by table, role by role; JWT claim setup; money-blind & pod-scope as policies; the per-role test matrix |
| [DATA-ACCESS.md](./DATA-ACCESS.md) | The mock→DB cutover contract: each `lib/`/`data/` builder → its Supabase query, signatures preserved; Server Action surface for mutations |
| [MIGRATION.md](./MIGRATION.md) | Order of domain cutover; seeding the existing mock data into the DB; how `localStorage` stores (notes/docs/broadcasts/pay overrides) become tables |
| [TESTING.md](./TESTING.md) | Test layers (schema constraints, RLS-per-role, query units, critical-flow e2e), tooling, fixtures, how each phase's gate is defined |

## 4. Phased build plan
Each phase: **scope → write tests → implement → verify (gate) → commit `feat(be): …` → STOP**.

| Phase | Scope | Done when |
|---|---|---|
| **B0 — Foundation** | Supabase project + local dev (CLI), env wiring, Supabase server/client helpers, migration tooling, CI for `supabase db diff`/tests. No app behavior changes yet. | `supabase start` works; a smoke migration applies; helpers typecheck |
| **B1 — Schema** | All tables, enums, FKs, indexes, `jsonb` columns per [SCHEMA.md](./SCHEMA.md), as migrations. Constraint tests (NOT NULL, FK, check, numeric money). | Migrations apply clean; constraint tests green |
| **B2 — Auth + RLS foundation** | Supabase Auth; JWT role/pod/entity claims; `ENABLE ROW LEVEL SECURITY` on every table; the core `rbac.ts`→policy mapping. Per-role RLS tests. | A user of each role can/can't read the right rows; money-blind + pod-scope proven by test |
| **B3 — Seed** | Import the existing mock data (`data/*`) into the DB as seed/migration so the app shows real-but-familiar data. | Seeded DB matches the mock fixtures the frontend expects |
| **B4 — Orders & catalog** | Cut over orders, order items, services/catalog, assignment behind their `lib/` builders. | Order pages render from DB; assignment works; tests green |
| **B5 — Staff work** | Tasks, deliverables, reviews, calendar/availability behind their builders. | Staff portal renders from DB; deliverable upload → Storage |
| **B6 — Finance & payroll** | Earnings, wallet, penalties, payouts, **pay overrides + presets + gig pricing**; `effectivePay`/`adminPayroll` against real data, in transactions. | Payroll explorer + staff finance reconcile to the formula; money-blind holds |
| **B7 — Affiliate** | Affiliates, referrals, commission events, payouts, clicks; tier math against DB. | Affiliate portal + admin affiliate render from DB |
| **B8 — Messaging & content** | Broadcasts, inbox, docs (audience gate), notes — the `localStorage` stores become tables with RLS. | Per-surface notes/docs/broadcasts persist server-side, audience-gated |
| **B9 — Tickets, audit, settings, analytics** | Remaining domains: tickets/support, audit log, settings, analytics aggregates. | Each surface renders from DB |
| **B10 — Hardening** | Rate limiting, CSRF/headers, indexes from query plans, e2e on critical flows, perf pass. | CWV/queries within budget; e2e green; security checklist passes |

> Cut-over phases (B4–B9) follow the **same recipe** regardless of domain — DATA-ACCESS.md defines it
> once. Do domains in dependency order (orders before staff work before finance).

## 5. Per-phase gate (Definition of Done)
A phase may commit only when ALL hold:
- [ ] Tests written first, now green; new backend code ≥80% covered.
- [ ] `supabase db lint` / migrations apply cleanly and are reversible.
- [ ] RLS proven from **every** affected role (incl. the money-blind manager + pod-scope).
- [ ] `pnpm --filter @heva/app exec tsc --noEmit` clean; existing 339 frontend tests still green.
- [ ] Cut-over domains: the page renders identically from DB (no frontend signature change).
- [ ] One focused commit `feat(be): <phase>`; then STOP and summarize for review.

## 6. Stop / intervene
- A migration is destructive or non-reversible → stop, surface it, do not apply.
- An RLS test shows a role seeing data it must not (esp. money) → **CRITICAL**, stop, fix before commit.
- A cut-over needs a frontend signature change → stop, propose it, get sign-off.
- More than ~12 files or a schema change touching money tables in one phase → pause and summarize.

## 7. The two unresolved architecture decisions (decide in B1)
Flagged independently by the frontend docs — resolve explicitly in SCHEMA.md before building:
1. **Affiliate role** — `lib/rbac.ts`'s `Role` union excludes affiliate. Decide: add a fifth
   `role` enum value (`users → affiliates` FK, like staff/customer) **or** a separate auth context.
   Recommendation: fifth role, unified auth, for one RLS model.
2. **External referred orders** — `CommissionEvent.order_code` may reference orders outside the
   `orders` table (referred external businesses). Decide: a `referred_orders` shadow table **or** an
   `external_order jsonb` column.

> **Resolved in the reference docs:** (1) affiliate added as a 5th `role` enum value with
> `affiliates.user_id → users` (also add `'affiliate'` to `lib/rbac.ts`'s `Role` union in B2);
> (2) `external_order jsonb` on `commission_events` with a check constraint that exactly one of
> `order_id` / `external_order` is set. See [SCHEMA.md](./SCHEMA.md).

## 8. Known cross-doc reconciliations (fix during B1/B2)
The reference docs were drafted in parallel; reconcile these before/while building so the migrations
are internally consistent:
1. **Table name** — SCHEMA.md uses `affiliate_tier_config` (singular); RLS.md uses
   `affiliate_tier_configs` (plural). Pick **singular** and use it everywhere (B1).
2. **Missing view** — RLS.md references a `catalog_packages_public` money-redacting view (strips
   `gig_rate`) but never defines it. Add `CREATE VIEW public.catalog_packages_public …` to the B2
   migration and point non-admin catalog queries at it.
3. **Missing table** — DATA-ACCESS.md's `portalDataFor` queries `affiliate_clicks`, but SCHEMA.md
   has no DDL for it. Add the `affiliate_clicks` table (+ RLS: affiliate self-select, admin all) in
   B1 before B7.
