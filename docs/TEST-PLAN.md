# HevaSEO — Test Plan & Feature Test Cases

> Living test plan for the backend + app. Organized **by feature**, mapped to the **layer** that proves
> each case. Last updated 2026-07-01.

## 1. Test layers (the pyramid)

| Layer | What it proves | Where | How to run |
|---|---|---|---|
| **Unit** | Pure logic — pricing, tier math, mappers, ledgers | `apps/app` (vitest), 378 tests | `pnpm --filter @heva/app test` |
| **DB (pgTAP)** | Every SECURITY DEFINER fn: RLS, authz gates, guards, money invariant, execute-grants — exhaustive per-fn | `supabase/tests/*.sql`, 524 tests / 68 files | `pnpm verify:db` |
| **Backend E2E (live)** | Real Supabase Auth + RLS + fns end-to-end across all 5 roles — behaviour & security through the actual API | `apps/app/scripts/e2e/`, 81 cases | `pnpm --filter @heva/app test:e2e` (env below) |
| **UI E2E (Playwright)** | Critical user journeys through the real Next app + browser | `apps/app/e2e-ui/`, 12 cases | `pnpm --filter @heva/app test:ui` |

**Golden rule:** DB-level exhaustive coverage lives in pgTAP; the backend E2E is the *live* layer that
proves the same guarantees hold through PostgREST with real JWTs; Playwright covers the rendered UI.

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

> Re-runnable: the backend E2E creates data (orders, payouts), so **reset before each full run**. The UI
> suite stubs reCAPTCHA (`window.grecaptcha`) so login is deterministic and needs no network.

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

## 6. Gaps / follow-ups
- UI E2E covers login + surface-render + RBAC gate; deeper UI journeys (place an order, approve a payout
  through the modal, submit a deliverable via the UI) are candidates to add next.
- Visual regression (screenshots per breakpoint/theme) not yet wired.
- The public checkout HTTP route is exercised at the DB layer (`materialize_order`) + code review; an
  HTTP-level test hitting the running route (provision/refuse/Turnstile) is a follow-up.
