# RESUME.md — HevaSEO backend build · session handoff

> Single entry point for a fresh session to continue the backend build. Updated 2026-06-29.
> Everything below is committed; this file + `docs/STATUS.md` are the resume anchors.

## TL;DR
- **Backend ~50%.** FOUNDATION (E0a · E0a+ · E0b · E0d) is **100% DONE + committed**. 194 pgTAP green.
- Now in **Phase 1 / Fleet Lane A** (wire the Next app `apps/app` to the real DB). **inc-1 (Supabase client) + inc-2 (auth session) done.**
- **NEXT ACTION:** Lane A **inc-3 = orders mock→real read swap (W1)** — replace `data/adminMock.ts → ORDERS` reads in the order pages with RLS-scoped `createClient()`/`getServerSession()` queries; seed real order rows; keep CONTRACTS §1 shape. Then **inc-4** wire create/advance/cancel + 1 order e2e.

## Get running (in order)
```bash
pnpm db:start          # Docker Supabase (Postgres 17 + Auth + Storage). Prints local keys.
pnpm verify:db         # reset + pgTAP — THE GATE (must be green). Slow (~min); use db:test as inner loop.
pnpm db:test           # fast pgTAP run against current DB
pnpm --filter @heva/app dev   # Next app on :4400 (another chat may hold it; config has app-3006/app-auto, or curl)
pnpm contract-coverage # guard: fails if any data/lib module is missing from CONTRACTS.md
```
- **Node:** shell default is nvm **20.20**; **gitnexus needs node 22** (`~/.nvm/versions/node/v22.22.2/bin` on PATH).
- App env: `apps/app/.env.local` (local Supabase URL + anon key) — gitignored; template in `.env.example`.

## Canonical docs (read these to rebuild context)
| Doc | What |
|---|---|
| `docs/STATUS.md` | The board — every slice's status. **Start here.** |
| `docs/ADR-backend.md` | Architecture decisions (K-keep / C-cut / W-watch + K9 money-stripped views, K10 act-as, K11 3 ledgers) |
| `docs/ORCHESTRATION.md` | Fleet plan (foundation-first, per-lane gates, agent contract) |
| `docs/CONTRACTS.md` | The data-access seam (frontend↔backend); `pnpm contract-coverage` keeps it complete |
| `docs/DATA-MODEL.md` · `docs/FEATURES.md` | Schema blueprint · feature catalog |

## Lane A inc-2 — auth session (DONE 2026-06-29)
- **2a** `handle_new_user` trigger (`20260629120000`): on `auth.users` insert → LINK an unclaimed shadow profile (preserves admin-set role) else CREATE. **SECURITY: signup metadata role/tenant is client-controlled → ignored; self-signup is always customer/agency** (no escalation). Seeds the single agency tenant `a9e0c0de-…-0001`. pgTAP `0240` (incl. hostile-metadata test). gác③ duyệt.
- **2b** `seed.sql`: 5 demo accounts (admin/manager/staff/customer/affiliate, pw `demo1234`) — shadow profile inserted **before** `auth.users` so the trigger LINKs (role preserved). Each needs an `auth.identities` row + token cols set to `''` (GoTrue NULL-scan 500 trap).
- **2c/2d** `lib/auth.ts`: `signInWithPassword`/`signUpCustomer` + `useSession`/`signOut` now real (cookie-backed); `getServerSession()` in `lib/supabase/server.ts` (RLS-scoped profile role) for inc-3; `middleware.ts` refreshes the session. Mock admin-provisioning (createAccount/outbox) kept for Lane E. Session/AuthRole shapes unchanged → 9 consumers untouched.
- **Verified e2e:** 5/5 personas mint a token via Kong with `app_role`/`tenant_id`/`profile_id` injected and route to the right portal (via the app's `@supabase/ssr` client).
- ⚠ **New gotcha:** `supabase db reset` restarts the auth container → Kong caches the old upstream IP → login 502s through `:54321`. Fix: `docker restart supabase_kong_<project>`.

## What's built (foundation — supabase/migrations + tests)
- **E0a** verify:db gate (pgTAP). **E0a+** `custom_access_token_hook` → injects tenant_id/app_role/profile_id into JWT (verified e2e via GoTrue).
- **E0b** 23 tables, all tenant_id + RLS (tenant isolation + role + money-blind staff/manager), `orders_mgr` money-stripped view, 3 wallets (customer_credit, staff_wallet, affiliate_commission) + manager wallet.
- **E0d** DB functions (SECURITY DEFINER, invariant `balance == SUM(ledger)`):
  `create_order` (atomic debit), `topup`, `advance_order` (allowed_transitions), `cancel_order`
  (**planned-only: new|confirmed|assigned**, before staff accepts; **5% cancel_fee**; refund 95% to dashboard credit incl. quick-buy), `post_staff_pay` (+ pod-manager override cascade), `post_affiliate_commission`.

## Gotchas that WILL bite (learned this build)
1. **Auth hook runs as `supabase_auth_admin`** → profiles RLS silently drops the claims (GoTrue still logs "success"). Fixed by policy `profiles_auth_admin_read`. Any new table the hook reads needs the same.
2. **`db reset` wipes everything** incl `auth.users` + any directly-committed rows. Never insert tenant `11111111-…` outside a txn — it collides with pgTAP seeds and fails the whole suite.
3. **Write migration SQL with the editor**, not a heredoc sharing a bash block with a long-running command (an interrupted block can leave the file empty while reset records it as applied).
4. **Money work is gác③** — human reviews each money function/RLS before commit (per ORCHESTRATION).
5. **Manager finance:** `/manager/finance` reuses staff `FinanceClient` with `showRewards={false}` + `payStyle="manager"`; comp = base + % pod gig + % pod commission (see `data/managerFinance.ts`, `MANAGER_PAYOUTS`).
6. **gitnexus** needs node 22 + re-`analyze` after changes; **graphify** scope = `apps/app/src` (SQL/migration changes don't affect it).

## Lane A — the W1 read-layer rewrite (next, biggest chunk)
The "swap mock→real is trivial" seam is optimistic (ADR §9): `ORDERS` etc. are read **synchronously**; real reads are **async + RLS-scoped + role-shaped** → Server Components get rewritten. Order of work:
- **inc-2 auth:** login page → `signInWithPassword`/magic link; middleware to refresh session; create a `profiles` row (with `user_id`) on signup so the hook resolves claims.
- **inc-3 read swap:** replace `data/adminMock.ts → ORDERS` reads in the order pages with `createClient()` queries (`lib/supabase/server.ts`), RLS-scoped. Seed real rows so the UI shows data. Keep the return shape matching `CONTRACTS.md` §1.
- **inc-4:** wire `create_order`/`advance_order`/`cancel_order` to UI actions; one order flow end-to-end on the real DB.

## Commit cadence
Per-increment commits, conventional-commits. Foundation money increments were human-reviewed before commit. `system-overview/*` + `AGENTS.md`/`CLAUDE.md` (gitnexus) are NOT ours — leave uncommitted.
