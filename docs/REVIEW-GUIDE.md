# HevaSEO — Project Review Guide

> Master index of all docs + a ready-to-paste prompt to spin up a **fresh session that reviews the whole
> project** (backend focus). Updated 2026-07-01, branch `feat/admin-ui`.

---

## A. Documentation map (read in this order)

| Doc | What it is | Read for |
|---|---|---|
| [PROJECT-GUIDE.md](PROJECT-GUIDE.md) | Developer onboarding: what it is, monorepo layout, run, 5 roles, RBAC, conventions | **Start here** — orientation |
| [BACKEND-BUILD-LOG.md](BACKEND-BUILD-LOG.md) | **Authoritative log of the entire backend build** (foundation → all lanes → provisioning → analytics → Stripe) | What was built + why + commits |
| [STATUS.md](STATUS.md) | The live board — lanes A–E with per-increment detail + the gác (gate) log | Current state, what's done/left |
| [CONTRACTS.md](CONTRACTS.md) | Every data-access module (reader/action/hook), REAL vs mock; guarded by `pnpm contract-coverage` | Where each surface gets its data |
| [ADR-backend.md](ADR-backend.md) | Architecture decisions (tenant model, RLS boundary, money invariant K11, gác③) | The "why" behind the schema/security |
| [DATA-MODEL.md](DATA-MODEL.md) | Entities + relationships | Domain model |
| [backend/SCHEMA.md](backend/SCHEMA.md) · [backend/RLS.md](backend/RLS.md) · [backend/MIGRATION.md](backend/MIGRATION.md) · [backend/TESTING.md](backend/TESTING.md) · [backend/ARCHITECTURE.md](backend/ARCHITECTURE.md) · [backend/DATA-ACCESS.md](backend/DATA-ACCESS.md) · [backend/PLAN.md](backend/PLAN.md) | Backend deep-dives (tables, policies, migration rules, test conventions) | Deep review of DB/RLS/tests |
| [rbac.md](rbac.md) | RBAC matrix (`lib/rbac.ts` single source) | Permission review |
| [FEATURES.md](FEATURES.md) · [ORCHESTRATION.md](ORCHESTRATION.md) | Feature catalogue + the fleet/lane plan | Scope & how it was sequenced |
| [RESUME.md](RESUME.md) | Older session-handoff (superseded by BACKEND-BUILD-LOG for the build history) | Historical context only |
| [audit/](audit/) · [superpowers/](superpowers/) | Page-crawl audit runbook + design specs | Frontend/QA context |

**Ground truth precedence:** code > `CONTRACTS.md` > `STATUS.md`/`BACKEND-BUILD-LOG.md` > older docs. Memories
in `~/.claude/.../memory/` (esp. `backend-build-resume.md`) are point-in-time notes — verify against code.

---

## B. Environment quick-start (needed before reviewing anything runnable)

```bash
cd <repo root>
pnpm install
pnpm db:start                                   # local Supabase (Docker)
pnpm db:reset && docker restart supabase_kong_hevaseo-platform   # pristine seed + refresh gateway
pnpm verify:db                                  # expect: 488 pgTAP PASS
pnpm --filter @heva/app exec next dev --port 4500   # app (demo logins: *@hevaseo.com / jane@acme.com / jane@janeseo.com, pw demo1234)
```

- **Node 22** required for gitnexus reindex (`$HOME/.nvm/versions/node/v22.22.2/bin`).
- Stripe test keys + `STRIPE_WEBHOOK_SECRET` live only in **gitignored** `apps/app/.env.local`.
- Keys for scripts: fetch at runtime — `pnpm exec supabase status -o json` (ANON_KEY / SERVICE_ROLE_KEY).

---

## C. Copy-paste prompt for a fresh review session

> Paste everything in the box below into a new session.

```
You are reviewing the HevaSEO platform backend (branch feat/admin-ui, monorepo: apps/app = Next.js app,
apps/web = Astro marketing). The backend was built over ~60 increments, wiring a Phase-0 localStorage
mock to real Supabase (Postgres + RLS + SECURITY DEFINER money fns) lane by lane. Do a THOROUGH,
evidence-based review. Do NOT change code unless I ask — this is a review.

FIRST, read these in order to orient (they are the ground truth, newest wins):
  1. docs/BACKEND-BUILD-LOG.md   (everything that was built, with commits)
  2. docs/STATUS.md              (live board, per-increment detail + the gác/gate log)
  3. docs/CONTRACTS.md           (every data-access module: reader/action/hook, real vs mock)
  4. docs/ADR-backend.md + docs/backend/RLS.md + docs/backend/SCHEMA.md  (security model)
Then use GitNexus MCP (this repo is indexed as "HevaSEO") to navigate: query({search_query}),
context({name}), impact({target}) before asserting how something works — prefer it over grep.

SET UP + RUN THE VERIFICATION GATES (report actual output, don't assume):
  pnpm db:reset && docker restart supabase_kong_hevaseo-platform
  pnpm verify:db                         # expect 488 pgTAP PASS
  pnpm --filter @heva/app test           # expect 378 app tests
  pnpm --filter @heva/app exec tsc --noEmit
  pnpm contract-coverage                 # expect 80 modules covered
  # smoke e2e (auth/RLS/lifecycle/security/money) — keys at runtime:
  J=$(pnpm exec supabase status -o json)
  SMOKE_URL=http://127.0.0.1:54321 \
  SMOKE_ANON=$(echo "$J"|node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).ANON_KEY))") \
  SMOKE_SVC=$(echo "$J"|node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).SERVICE_ROLE_KEY))") \
    node apps/app/scripts/smoke.e2e.mjs  # expect 21/21

REVIEW FOCUS (produce findings with severity CRITICAL/HIGH/MEDIUM/LOW + file:line evidence):
  1. SECURITY / RLS (highest priority — this is a multi-tenant money app):
     - Every money/authoring table must be SELECT-only via RLS; writes only through SECURITY DEFINER fns.
       Audit supabase/migrations/*.sql: is any table missing RLS, or granting INSERT/UPDATE/DELETE to
       anon/authenticated? (`grant select on allowed_transitions` reference table is knowingly RLS-off.)
     - Role forgery: fns must derive actor/role/tenant from JWT claims (current_app_role() etc.), never
       trust client-passed role/tenant. Check every fn granted to `authenticated`.
     - Tenant isolation: does any policy/fn allow cross-tenant read/write? (tenant_id is THE boundary.)
     - Money-blind: staff/manager must never read order value / other wallets (orders_mgr view, money-blind
       RLS). Verify no value leak in readers or embeds.
     - Service-role usage: which routes use createServiceClient (checkout, webhook) and are they gated
       (signature verify / server-priced / idempotent)? Any service client reachable by the client?
     - Public endpoints: /api/public/checkout, /api/stripe/webhook, /r/:code — verify auth/rate-limit/
       signature/idempotency.
  2. MONEY INVARIANT: every money fn must keep balance == SUM(ledger) atomically. Read the 3 wallet systems
     (customer_balances/credit_ledger, staff_wallet/wallet_ledger, affiliate_commission/commission_ledger)
     + refunds (cancel_order, resolve_payout reject, transfer.reversed). Look for non-atomic debit/credit.
  3. CORRECTNESS: idempotency (materialize_order by checkout_ref, resolve_* re-resolve guards, webhook
     re-fire), transition legality (allowed_transitions), the Stripe transfer-before-mark-paid ordering.
  4. TESTS: is coverage meaningful? pgTAP asserts RLS + guards + invariants per fn; are there gaps (a fn
     with no negative/authz test)? App unit tests cover pure logic (pricing, tier math, mappers).
  5. DATA-ACCESS HYGIENE: does every reader match CONTRACTS.md? Any reader bypassing RLS unnecessarily?
  6. CODE QUALITY: files <800 lines, functions focused, error handling, no console.log/secrets in code.

KNOWN, INTENTIONAL SCOPE (do NOT flag as bugs — see BACKEND-BUILD-LOG §10):
  - Subtask model deferred (task = order). tasks table exists but unused.
  - AudienceAnalytics panel stays mock (external product-analytics territory, not the transactional DB).
  - Admin staff/managers DIRECTORIES are rich-mock display (only Mai is fully-real in seed); real
    provisioning/assignment/perf land in the DB + overlay for display.
  - Client-side soft checks (e.g. $50 payout pre-check) are UX; the server fn is source of truth.
  - Stripe whsec is per-`stripe listen`-session locally; PayPal sandbox not wired (seam ready).

DELIVERABLE: a structured review report — (a) security/RLS findings, (b) money-invariant findings,
(c) correctness/idempotency, (d) test-coverage gaps, (e) code-quality notes, (f) a prioritized fix list.
Cite file:line. Distinguish real issues from the intentional scope above. If you want a deeper pass on one
area, say so and I'll approve.
```

---

## D. Fast reviewer orientation (the 10-minute version)

- **Security spine:** JWT claims (`custom_access_token_hook`) → RLS policies (tenant + role + money-blind)
  → SECURITY DEFINER fns for all writes. Read `docs/backend/RLS.md` + skim `supabase/migrations/*.sql`.
- **Money spine:** 3 ledgers, invariant `balance == SUM(ledger)`, refunds reverse the exact debit. Grep
  `SUM(` in `supabase/tests/*.sql` to see the invariant asserted per fn.
- **Provisioning spine:** shadow-profile → `handle_new_user` LINK (role never client-trusted).
- **Data spine:** `CONTRACTS.md` maps every surface → its reader/action; `pnpm contract-coverage` proves
  none is undocumented.
- **Highest-value files to read:** `20260629130000_harden_order_write_fns.sql`, `..._fn_post_commission.sql`,
  `20260629120000_handle_new_user.sql`, `apps/app/src/middleware.ts`, `app/api/public/checkout/route.ts`,
  `app/api/stripe/webhook/route.ts`, `apps/app/scripts/smoke.e2e.mjs`.
