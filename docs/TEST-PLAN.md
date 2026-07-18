# HevaSEO — Test Plan & Feature Test Cases

> Living test plan for the backend + app. Organized **by feature**, mapped to the **layer** that proves
> each case. Last updated 2026-07-18 (counts refreshed + §6/§7 gap review added).

## 1. Test layers (the pyramid)

| Layer | What it proves | Where | Runs in CI? |
|---|---|---|---|
| **Unit** | Pure logic — pricing, tier math, mappers, ledgers, ASC 606 rules | `apps/app` (vitest), **22 files / 437 tests** | ✅ yes (`app` job) |
| **DB (pgTAP)** | Every SECURITY DEFINER fn: RLS, authz gates, guards, money invariant, execute-grants — exhaustive per-fn | `supabase/tests/*.sql`, **88 files / 722 tests** | ✅ yes (`db` job) |
| **Backend E2E (live)** | Real Supabase Auth + RLS + fns end-to-end across all 5 roles — behaviour & security through the actual API | `apps/app/scripts/e2e/`, **8 features / 105 cases** | ✅ **yes (`e2e` job)** — added 2026-07-18 |
| **UI E2E (Playwright)** | Critical user journeys through the real Next app + browser | `apps/app/e2e-ui/`, **35 specs / 98 cases** | ❌ **NO — parked (§7 Phase 1.3)** |

**Golden rule:** DB-level exhaustive coverage lives in pgTAP; the backend E2E is the *live* layer that
proves the same guarantees hold through PostgREST with real JWTs; Playwright covers the rendered UI.

> **Backend live layer is now wired.** `.github/workflows/ci.yml` runs `app` (unit) + `db` (pgTAP) +
> `e2e` (live, 101 cases across 5 roles) — all green on a from-scratch DB. The 98-case Playwright UI
> suite is still unrun (it needs the Next app + a browser — heavier); that's the remaining Phase 1 step.

> ⚠ **`pnpm verify:db` contains `supabase db reset`** (`package.json`). That command wipes a real dev
> database — **never run it against your working DB.** For a safe local pgTAP run use `supabase test db`
> alone (no reset); the from-scratch reset belongs only on CI's throwaway Postgres.

## 2. How to run (live)

```bash
# 0) pristine stack (both live layers assume the seeded, pristine DB)
pnpm db:reset && docker restart supabase_kong_hevaseo-platform
nvm use 22                     # realtime-js needs Node 22 native WebSocket

# 1) DB + unit
pnpm verify:db
pnpm --filter @heva/app test

# 2) backend behavioral E2E (real auth/RLS/money)
J=$(pnpm exec supabase status -o json)
SMOKE_URL=http://127.0.0.1:54321 \
SMOKE_ANON=$(echo "$J"|node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).ANON_KEY))") \
SMOKE_SVC=$(echo "$J"|node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).SERVICE_ROLE_KEY))") \
  pnpm --filter @heva/app test:e2e

# 3) UI journeys (auto-starts next dev on :4455)
pnpm --filter @heva/app test:ui
```

> ⚠ **Run this against a throwaway/ephemeral stack, never your working dev DB** — `db:reset` wipes real
> data. On CI the DB is disposable, so reset is safe there; that's why the live layers belong in CI (§7).
>
> Re-runnable: the backend E2E creates data (orders, payouts), so the stack must be **pristine before each
> full run**. The UI suite stubs reCAPTCHA (`window.grecaptcha`) so login is deterministic and needs no network.

## 3. Feature test cases + coverage map

Legend: ✅ covered · layer in parens. "authz−" = negative/denial case.

### F1 — Auth & session (5 roles)
- ✅ each role signs in → correct `app_role` JWT claim (E2E, UI)
- ✅ each role lands on its home surface (`/admin /manager /staff /dashboard /affiliate`) (UI)
- ✅ wrong password rejected (E2E, UI)
- ✅ self-signup is forced to `customer`; hostile metadata role/tenant ignored (pgTAP `0240`)
- ✅ unauthenticated `/admin` → `/login` (UI)

### F2 — RLS tenant/role isolation
- ✅ admin sees all; customer only own orders/customer; staff 0 base orders (money-blind) (E2E, pgTAP)
- ✅ manager reads `orders_mgr` (pod + unassigned), **value column absent** (E2E, pgTAP `0180`)
- ✅ cross-customer order/balance read denied; staff/affiliate wallets invisible to customer (E2E)
- ✅ **profiles enumeration closed** — customer can't list the roster / see admin/manager (E2E, pgTAP `0630`)

### F3 — Order lifecycle
- ✅ create → new; admin advance new→confirmed; illegal transition rejected (E2E, pgTAP)
- ✅ authz−: customer forges advance BLOCKED; staff advances only own order (E2E, pgTAP)
- ✅ cancel refunds 95% + keeps 5% fee; staff cannot cancel (E2E, pgTAP `0030`)

### F4 — Money invariant (balance == SUM(ledger))
- ✅ customer credit, staff wallet, affiliate commission invariants (E2E, pgTAP per-fn)
- ✅ quick-checkout `materialize_order` idempotent by `checkout_ref` (E2E, pgTAP `0280`)

### F5 — Payouts & finance
- ✅ staff payout: below-min rejected; request debits; admin reject refunds; no re-resolve; customer denied (E2E, pgTAP `0290/0300`)
- ✅ affiliate payout: min enforced; request + admin reject-refund; customer denied (E2E, pgTAP `0390/0400`)
- ✅ penalties: apply→dispute→waive refunds, invariant holds; customer cannot apply (E2E, pgTAP `0310`)
- ✅ payroll: admin-gated, idempotent per period; non-admin denied (E2E, pgTAP `0320`)

### F6 — Provisioning & privileged invite
- ✅ admin creates staff/manager/affiliate shadows; non-admin denied (E2E, pgTAP)
- ✅ **escalation guard**: open self-signup cannot claim a privileged shadow (E2E, pgTAP `0650`)
- ✅ sanctioned invite: service-role `createUser` + `claim_invite` links it; customer/anon cannot `claim_invite` (E2E, pgTAP `0660`)
- ✅ admin create modals surface the temp password (manual/UI)

### F7 — Collaboration
- ✅ staff submits deliverable on own order; foreign/customer denied; admin reviews (E2E, pgTAP `0570/0580`)
- ✅ order messages: participant-gated; customer forced non-internal; **customer never sees internal notes** (E2E, pgTAP `0590`)
- ✅ authz−: customer cannot post on a foreign / shadow-customer order (E2E, pgTAP `0670` — see §4)

### F8 — Docs & broadcasts (array-RLS)
- ✅ customer sees customer-audience doc, NOT a staff-only doc; every visible doc targets their audience (E2E, pgTAP `0080`)
- ✅ broadcasts scoped by audience per role (E2E, pgTAP `0090`)

### F9 — Affiliate program
- ✅ affiliate reads own commission wallet/ledger + tier config; updates own profile; customer cannot set code (E2E)
- ✅ click tracking via public fn (anon); only admin pins tier (E2E, pgTAP `0500/0420`)

### F10 — Public endpoints & security posture (live)
- ✅ money-mint fns (`post_staff_pay`/`post_affiliate_commission`) unreachable by customer/anon (E2E, pgTAP `0620`)
- ✅ money-in fns (`create_order`/`topup`/`materialize_order`) + `rate_hit` service-role only (E2E, pgTAP)
- ✅ checkout: server-priced, idempotent, non-customer email refused, Turnstile-gated (pgTAP core + code)
- ✅ webhook: signature-verified, retries on handler failure (code + `0530`)

## 4. Bug found by this suite (fixed)

**`post_order_message` participant-gate NULL leak** — the check `v_cust_user = v_pid` evaluated to
`NULL` when the order's customer was an unclaimed **shadow** (`user_id IS NULL`), and `if not (… or NULL)`
does not raise → any customer could post on a shadow-customer's order (same leak for staff on unassigned
orders). Fixed with `coalesce(… = v_pid, false)` (migration `20260701470000`), guarded by pgTAP `0670`
and the F7 E2E denial case.

## 5. Directory map
- `apps/app/scripts/e2e/lib.mjs` — harness (clients, login, assert helpers, seed constants)
- `apps/app/scripts/e2e/features/01..06-*.mjs` — feature suites
- `apps/app/scripts/e2e/run.mjs` — orchestrator
- `apps/app/e2e-ui/` — Playwright specs (`auth`, `surfaces`) + `helpers.ts` + `playwright.config.ts`

## 6. Gap review (2026-07-18)

Two kinds of gap. **Functional gaps** (a feature that doesn't fully work in the real app) outrank
**test gaps** (a working feature with no test) — the first blocks, the second warns.

### 6A. Functional gaps — ranked

| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| 1 | **Staff-wallet commission is never minted in the running app.** `post_staff_pay` (credits `staff_wallet` on delivery) has **zero app callers** — only `seed.sql` + pgTAP call it. A real staffer's wallet commission ledger stays empty; commission only surfaces via the payroll *computation*. Wire it into delivery, or stop the wallet advertising commission it never gets. **Design decision — the biggest "sót".** | only ref in `apps/app/src` is a comment, `data/staffWallet.server.ts:11` | HIGH — decide |
| 2 | **Password reset is fake** — `/forgot-password` + `/reset-password` write a localStorage outbox/record, not Supabase Auth. (Login/signup/session ARE real.) | `lib/auth.ts:221,227` | HIGH |
| 3 | **`/admin/settings` is entirely unwired** — every tab renders `ADMIN_SETTINGS` mock; the page says so. | `app/admin/settings/page.tsx:8` | HIGH |
| 4 | **Public checkout bot-check is a no-op** — Turnstile is a documented stub; only an in-memory IP limiter guards it. | `app/api/public/checkout/route.ts:16,39,52` | HIGH (security) |
| 5 | **Temp-credential "email" is a mock outbox** — account creation is REAL (`create_staff_member`/`create_manager`), but the temp password only shows in a localStorage drawer; no mail is sent. | `components/admin/accounts/OutboxDrawer.tsx` | MEDIUM |
| 6 | **`run_payroll` idempotency is amount-blind & one-shot per period** — re-running returns the first row and ignores new amounts. If an order is delivered *after* payroll ran that month, `outstanding` shows >0 but Pay does nothing, and a wrong first payment can't be corrected without deleting the row. | `payroll_commission.sql:35-36` | MEDIUM |
| 7 | **Pure-mock staff surfaces** (no backend): Deliverables, Notifications, Calendar, Performance, Settings, History. | `app/staff/{deliverables,notifications,calendar,performance,settings,history}` | MEDIUM |
| 8 | **`MOCK_TODAY` frozen clock still live in ~6 rendered surfaces** — they show 2026-06-24 as "today" while real-clock pages show the true date. | `staff/finance/FinanceClient.tsx:20`, `staff/performance/page.tsx:747`, `staff/settings/SettingsClient.tsx:39`, `admin/managers/page.tsx:10`, `admin/staff/[id]/StaffProfileClient.tsx:221`, `affiliate/(dash)/page.tsx:24` | MEDIUM |
| 9 | **Manager Audit is mock** (admin audit was migrated); **Admin › Staff › Leave is mock**. | `app/manager/audit/page.tsx:3`; `app/admin/staff/leave/page.tsx:1` | MEDIUM |
| 10 | **Hardcoded customer-dashboard figures** — active-projects count, membership tier, on-time % (last has a `TODO(backend)`: orders carry no on-time flag). | `components/DashboardTop.tsx:28,179` | LOW |
| 11 | **Affiliate self-registration writes localStorage**, not a Supabase signup (unlike `/register`). | `data/affiliateAdminStore.ts:88` | LOW |
| 12 | **localStorage display-overlays** for freshly-created staff/manager/affiliate rows (rendered instead of re-fetched) → transient drift after the real RPC. | `StaffClient.tsx:131`, `ManagersClient.tsx:117` | LOW |
| 13 | **Staff/manager avatar upload not wired** (customer avatar IS, via the `avatars` bucket). | `StaffProfileClient.tsx:963` | LOW |
| 14 | **Analytics "Audience" panel is mock** (openly "Demo data") — no product-events pipeline. Everything else on `/admin/analytics` (revenue, geo counts, support, team) is REAL. Accept if intended. | `components/admin/AudienceAnalytics.tsx:3` | ACCEPT? |
| 15 | **Dead export** — `data/affiliate.server.ts` `payoutMethodLabel`/`getMyAffiliate`/`getAffiliateById` have no importers. | — | LOW |

### 6B. Test-coverage gaps

| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| B1 | **~200 live E2E cases exist and CI runs none of them** (§1). Backend 7 features / 98 cases + Playwright 35 specs / 98 cases, both wired to package.json scripts but no workflow. | grep `.github/` for `test:e2e`/`playwright` = empty | **HIGH** |
| B2 | **Manager "standing modes" entirely untested — and they touch a check that keeps regressing.** `auto_assign_order` + `set/my_away_auto_assign` and `auto_review_order` + `set/my_auto_review` have **0 pgTAP refs**. The current `advance_order` carries a comment (`manager_auto_review.sql:50`) that a later redefinition *dropped the manager pod-ownership check and it had to be restored* — a known recurring bug with no regression guard. | 0 refs (verified) | **HIGH** |
| B3 | **`set_staff_comp` untested** — mutates staff pay rate; feeds payroll + commission. Highest-value single untested money fn. | 0 refs | HIGH |
| B4 | **13 more untested SECURITY DEFINER fns:** `decline_quote`, `revise_delivered`, `reassign_project_orders`, `revoke_api_key`, `delete_webhook`, `edit_deliverable`, `mark_deliverable_viewed`, `set_notif_prefs`, `mark_broadcast_dismissed`, `sync_profile_email`, `current_customer_id`, `order_assignee_id`, `my_*` readers (19 untested of 93 total). | verified | MEDIUM |
| B5 | **Untested money TS logic** (not just RLS wrappers): `data/managerFinance.ts` (pod-override pay math), `adminComp.server.ts` preview math, `data/adminCustomerInsight.ts`. | — | MEDIUM |

## 7. The plan — phased

**Shaping rule:** the from-scratch suites need a pristine seed (`db:reset`). **Never reset the dev DB.**
Run those on CI's throwaway Postgres or a separately-spun ephemeral DB — hence "wire into CI", not
"run locally".

### Phase 1 — make the existing E2E real _(highest ROI, do first)_
The order/payroll automation you asked about is **already written**; it just doesn't run.
1. ✅ **DONE** — verified green on a from-scratch CI DB: **101 passed, 0 failed**. Pre-flight first confirmed no signature rot (every RPC the suite calls resolves to a current signature with all required params).
2. ✅ **DONE** — added the `e2e` CI job (commit `58aec9d`), mirroring the `db` job: `supabase start` (migrations + seed) → `test:e2e` with `SMOKE_*` from `supabase status -o json`. Green on the first run.
3. ⬜ **TODO** — the Playwright UI specs (`test:ui`, 98 cases) stay parked: they need the Next app running on :4455 + a browser (`playwright install`), a heavier and flakier job. Wire as a follow-up or keep parked deliberately.

### Phase 2 — the two flows you named, tied to money ✅ **DONE**
The existing E2E drove *states* but not the *money book*. `08-revenue-payroll.mjs` (new feature, wired into `run.mjs`) closes both, driven live end-to-end:
- **Flow 1 — place order → revenue recognized.** Captures `revenue_book().total.recognized`, places an order (asserts recognized is **unchanged** — booking ≠ revenue), walks it topup→assign→work→submit→**deliver**, then asserts recognized rose by **exactly the order value** (ASC 606). Nothing asserted this before.
- **Flow 2 — pay staff from a *delivered order*.** Turns the pod manager's `auto_review`/`away` **off** for determinism, `set_staff_comp(Mai, base, pct)`, then `run_payroll` for the delivery's month → asserts `total = base + value×pct%` and the commission leg, then **re-runs with different inputs and asserts one unchanged row** (pins the amount-blind idempotency of gap #6).
  - Uses a numeric-priced service (Backlink) and the real clock; runs last so its `revenue_book` delta is just its own order.

### Phase 3 — close the ranked untested fns with pgTAP _(each sabotage-verified)_
1. ✅ **DONE** — `0840_manager_standing_modes_test.sql` (20 assertions). Pins both toggles as manager-only, both internal fns as not-client-callable, auto-assign as pod-scoped, and an auto-reviewed order as delivered_at-stamped. **Assertion #14 is the regression guard:** a manager cannot advance an order worked outside their own pod (`NOT_YOUR_POD`). Sabotage-verified — stripping the pod check from `advance_order` (the exact historical regression) turns #14 red; restoring it passes. Suite now 85 files / 679 tests.
2. ✅ **DONE** — `0850_fn_set_staff_comp_test.sql` (18 assertions): admin-only (staff/manager/customer → NOT_ADMIN — managers are pay-blind too), value guards (salary ≥ 0, 0 ≤ rate ≤ 100), target guard (staff/manager only), upsert (one row per person), and RLS read scope (self-only; a colleague's pay is invisible). Sabotage-verified: stripping the admin gate turns the three NOT_ADMIN assertions red.
3. ✅ **DONE** — `0860_fn_quote_decline_revise_test.sql` (15): `decline_quote` (customer-only, own-quote-only, not-open guard) and `revise_delivered` (staff-assignee-only, delivered-only, versioned re-open). Sabotage-verified: stripping `decline_quote`'s ownership check turns its NOT_YOUR_QUOTE assertion red.
4. ✅ **DONE** — `0870_fn_settings_delete_test.sql` (10): `revoke_api_key`, `delete_webhook` — customer-only and own-scoped (a colleague's revoke/delete is a silent no-op). Sabotage-verified: stripping the own-scope from `revoke_api_key` lets one customer revoke another's key → red.
5. ⬜ **TODO (lower)** — `reassign_project_orders`, `edit_deliverable`/`mark_deliverable_viewed`, `set_notif_prefs`, `mark_broadcast_dismissed`.

### Phase 4 — unit tests for untested money TS logic (vitest)
`data/managerFinance.ts` (pod-override: `10%·gig + 15%·commission` — a different formula from the payroll path, easy to cross), `adminComp.server.ts` preview math (accrued − paid = outstanding, clamped ≥ 0), `data/adminCustomerInsight.ts`. Extract pure fns trapped behind `server-only` (the `adminRevenue.ts` split is the template).

### Phase 5 — frontend / visual (Playwright) _(lower priority)_
Extend the specs: screenshot the money surfaces at 320/768/1024/1440 in light & dark; a11y pass on `/admin/finance` + the order flow; gate on no-overflow + contrast.

### Suggested order
1. **Phase 1** — turns ~200 already-written, dead E2E cases into a running gate. Biggest return.
2. **Phase 2 Flow 2 + Phase 3 #1** — covers "auto pay staff" *and* the highest-risk untested area together.
3. **Phase 2 Flow 1 + Phase 3 #2** — revenue-recognized assertion + `set_staff_comp`.
4. **Functional gaps (§6A)** are product calls (wire password reset? admin settings? mint wallet commission on delivery?), decide separately from test work.
