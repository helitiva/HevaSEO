# HevaSEO — Backend Build Log

> Authoritative, chronological log of the backend build on branch `feat/admin-ui`.
> Last updated: 2026-07-01. Companion: [REVIEW-GUIDE.md](REVIEW-GUIDE.md) (how to review the project),
> [STATUS.md](STATUS.md) (the live board), [CONTRACTS.md](CONTRACTS.md) (every data-access module).

## 0. Snapshot (current state)

- **Backend is feature-complete for the current model.** Every role's money / RLS / collaboration /
  provisioning / analytics surface reads & writes **real Supabase** (Postgres + RLS), replacing the
  Phase-0 localStorage mock lane by lane.
- **Verification (last full run, pristine DB):**
  `pnpm verify:db` → **488 pgTAP** · `pnpm --filter @heva/app test` → **378 app unit tests** ·
  `npx tsc --noEmit` clean · `pnpm contract-coverage` → **80 modules** ·
  `node apps/app/scripts/smoke.e2e.mjs` → **21/21** · authed render of 8 admin pages → **200, no crash**.
- **Totals:** 74 migrations · 62 pgTAP files · 41 migrations defining SECURITY DEFINER fns · 18 `.server.ts` readers.
- **Stripe test mode LIVE** incl. Connect payouts + webhook (see §7).

### The core pattern
Every increment: **real reader (`data/*.server.ts`, RLS-scoped) ?? mock fallback** for reads, and
**server action → SECURITY DEFINER Postgres fn** for writes. Money/authoring tables are **SELECT-only via
RLS**; all writes go through admin-gated or claims-derived fns. Money invariant enforced everywhere:
**`balance == SUM(ledger)`** (ADR "K11"). The money gate (**gác③**) = human-reviewed before merge.

---

## 1. Foundation (E0a–E0d) — pre-existing, verified

- **E0a** `verify:db` gate (migrations apply + pgTAP green in one command).
- **E0a+** `custom_access_token_hook` injects `tenant_id` / `app_role` / `profile_id` / `skills` into the JWT
  (Auth hook runs as `supabase_auth_admin` → needs read-all policies on `profiles`/`staff_details`).
- **E0b** 23 tables + RLS (tenant + role + money-blind) + `orders_mgr` money-stripped view + 3 wallets.
- **E0d** 8 SECURITY DEFINER money fns; hardened `2fe9bcf` (advance/cancel claims-derived + authz;
  create_order/topup service_role-only — role-forgery closed).
- Helper fns: `current_tenant_id()` / `current_app_role()` / `current_profile_id()` / `current_skills()`
  (from JWT claims); `order_assignee_id()` / `order_pod_manager()` (SECURITY DEFINER, RLS-bypass lookups).

---

## 2. Lane A — Orders (auth session → read swap → lifecycle writes) ✅

- **inc-1/2** Supabase client + types; **auth session**: `handle_new_user` trigger (shadow-claim | forced-
  customer self-signup — signup metadata role/tenant NEVER trusted), 5 demo accounts (`demo1234`), real
  login/signup/session + middleware.
- **inc-3a–3g** RLS-scoped readers: `getOrders`/`getOrderById`, `/admin/orders`(+detail), `/manager/orders`
  via `orders_mgr` (money-blind), customer `/dashboard` (`getMyOrders`), `/admin/customers` (`getCustomers`),
  `/admin/staff` (`getStaff`).
- **inc-4a–4c** writes: `advanceOrderAction` (advance_order), `cancelOrderAction` (cancel_order, 95% refund +
  5% fee, gác③); seed runs money through topup+create_order so balance==SUM holds.
- **Lane A cleanup** (`cc909cd`) staff My Tasks board via `orders_mgr` (money-blind, assignee-scoped).
- **Assign + transitions** (`bd8d5d3`) `assign_order` (admin-gated) + `assignOrderAction`; staff task-detail
  transitions via advance_order (ownership-enforced).
- **STEP 2** `order_details` (brief) + `order_addons` (money-blind) + `/admin/assignment` + `/admin/review`
  readers + slide-over lazy fetch (`useOrderDetail`).
- **Model note:** *task = order* (subtask model deferred by product decision).

## 3. Lane B — Credit + checkout + Stripe seam ✅

- **inc-B1** `/credit` real balance+ledger (`getMyCredit`). **inc-B2** pure `computeOrderPrice` server pricing.
- **inc-B3** create-order-from-UI: `placeOrderAction` server-prices (client total never trusted) → create_order
  via service-role client; debit + order_details/order_addons.
- **Phase 2** simulated-Stripe top-up + real `invoices` + **payment-provider seam** (`lib/payments/provider.ts`);
  quick-checkout `materialize_order` (atomic, idempotent by `checkout_ref`) + public `POST /api/public/checkout`
  (the "6 chốt": server price · rate-limit · idempotent · temp-password · email-collision · reconcile).
- **Stripe test mode** (`aa66f3e`,`257dfdb`) StripeProvider + Stripe Link Payment Element on top-up.

## 4. Lane C — Docs + broadcasts ✅

- **C1–C3** docs array-RLS read (all surfaces) + JWT skill-gate + admin CRUD (`upsert_doc`/`delete_doc`,
  `lib/docAudienceMap.ts` bridges role+skill audience model ↔ `audiences[]`+`required_skills[]`).
- **C4–C6** broadcasts: recipient read (inbox/bell/banner/site-alert) + admin compose/recall/delete
  (`upsert_broadcast`/`set_broadcast_status`/`delete_broadcast`) + real read-receipts (`mark_broadcast_read`/
  `_click`) + real analytics from roster + `broadcast_events`.

## 5. Lane D — Staff/manager wallet + payroll ✅

- **D1–D2** staff commission wallet read (`getMyStaffWallet`) + `/staff/finance`.
- **D3–D4** payout request (`request_payout`, claims-derived) + admin resolve (`resolve_payout`, approve/pay/
  reject+refund, gác③).
- **D5** penalties (`apply`/`dispute`/`waive_penalty`+refund). **D6** manager finance + manager payouts
  (pod-override cascade via `post_staff_pay`). **D7** payroll runs (`run_payroll`, idempotent per period).
- **Polish** real payout-method management + real payslips.

## 6. Lane E — Affiliate/KOL (the deepest lane) ✅ E1–E22

| inc | commit | what |
|---|---|---|
| E1 | `22c464c` | affiliate dashboard reads real commission (`getMyAffiliate`) |
| E2 | `7544393` | payout request write (`request_affiliate_payout`, $ min, atomic, K11) |
| E3 | `758966c` | admin resolve payout + real directory (`resolve_affiliate_payout`, refund on reject) |
| E4 | `e9fe620` | admin impersonate → reads real partner portal (`getAffiliatePortalData`) |
| E5 | `378b795` | partner status write (`set_affiliate_status`; UI suspended↔DB churned) |
| E6 | `e24beae` | tier override (`set_affiliate_tier`; pin vs auto via `tier_pinned`) |
| E7 | `0fbad48` | program config write (`affiliate_program_config`/`_tier_config` + upserts, Rules tab) |
| E8 | `3fa09b2` | **enforce** config `min_payout` in `request_affiliate_payout` |
| E9 | `b012cd2` | admin console tier from config thresholds (not lib ladder) |
| E10 | `dffd779` | partner dashboard uses config tier ladder (tenant-read policy; `tierForIn`/`tierProgressIn`) |
| E11 | `e206316` | referrals sub-page reads real |
| E12 | `c349cc3` | marketing metadata (platform/niche/audience/clicks) + self-edit (`update_affiliate_profile`) |
| E13 | `e84b4e8` | **admin creates affiliate (real provisioning)** — shadow-profile → LINK model |
| E14 | `52d90a8` | self-service settings: name + referral code (`set_affiliate_code`) |
| E15 | `8ab2f99` | payout methods (`affiliate_payout_methods` + add/set-default/remove, one-default) |
| E16 | `c72aa3b` | click tracking pipeline (`affiliate_clicks` + `record_affiliate_click` + public `/r/:code`) |
| E17 | `4345c8d` | click dedup (per-code cookie window) |
| E18 | `52d1e97` | email change via GoTrue verified flow + `sync_profile_email` trigger |
| E19 | `2c5e4d4` | **Stripe Connect onboarding** (Express account + hosted link; `set_affiliate_stripe_account`) |
| E20 | `6890d53` | **execute Stripe transfer on payout** (real money to connected account before marking paid) |
| E21 | `0faa89a` | per-IP click rate-limit |
| E22 | `06ee187` | **Stripe webhook backstop** (`/api/stripe/webhook`: account.updated + transfer.reversed) |

**Config loop fully closed:** author (E7) → enforce min_payout (E8) → tiers drive admin console (E9) &
partner dashboard (E10). **Money loop:** provision → claim → dashboard → refer → commission → payout
request → admin resolve/refund → **real Stripe Connect transfer** → webhook reconcile.

## 7. Provisioning — shadow-profile → LINK (all 4 privileged roles real)

Model: admin inserts a **shadow profile** (target role, `user_id = null`, `status = 'invited'`) + role rows;
the person **claims** it by signing up with that email → `handle_new_user` LINKs, preserving the admin-set
role. **No client-trusted role, no server-side auth-user creation.**

| inc | commit | what |
|---|---|---|
| E13 | `e84b4e8` | `create_affiliate_partner` (shadow + affiliates row + commission wallet) |
| E23 | `0654199` | `create_staff_member` (shadow + staff_details + staff_wallet) |
| E24 | `b6076c2` | `create_manager` (shadow + wallet for managers; role manager|admin) |
| E25 | `ce5b223` | `assign_staff_to_manager` (pod link `staff_details.manager_id` → override cascade) |
| E26 | `fc5534c` | manager title/rank persisted (staff_details "org card" + `rank` col) |

## 8. Collaboration + computed metrics

| inc | commit | what |
|---|---|---|
| E27 | `88c623c` | staff submits real deliverable (`submit_deliverable`, assignee-only) |
| E28 | `ee1c612` | admin reviews deliverable (`review_deliverable`, approve/request_changes) |
| E29 | `8af45cf` | in-order task messages (`order_messages` + `post_order_message`; `internal` flag) |
| E30 | `517e536` | customer message UI (OrderDetailPanel comments → real) |
| E31 | `87cfed4` | pod-manager messages (RLS + fn branch + admin/manager thread) — **thread real on all 4 surfaces** |
| E32 | `0a67628` | computed staff perf (`staff_perf_all`: quality/on-time/throughput from real deliverables) |
| E33 | `fa0785e` | staff My Day reads real tasks |

## 9. Analytics + Stripe ops (final round)

- **`/admin/analytics` real** — revenue (`c0dfe50`: `getAnalytics` → KPIs / 90-day series / service-mix /
  by-source / top-customers) + **team perf / support / geo** (`fb820df`: `TeamPerformance`←getStaff,
  `SupportStats`←`getSupportStats` from 12 seeded tickets, `GeoPanel`←`getGeoStats` via new
  `customers.country_iso`).
- **Stripe webhook LIVE (2026-07-01):** Stripe CLI (scratchpad binary; no brew) →
  `stripe listen --api-key <sk_test from .env.local> --forward-to :4500/api/stripe/webhook`; real
  `account.updated` returns **[200]**. `STRIPE_WEBHOOK_SECRET` in gitignored `apps/app/.env.local`.
  ⚠️ `stripe listen` mints a **new whsec per session** → re-run + re-append (or register a dashboard
  endpoint with a public URL) for persistence.

---

## 10. Intentional scope decisions & known non-gaps

These are deliberate, **not** unfinished BE:

1. **Subtask model** — deferred by product decision (*task = order* now). The `tasks` table exists (unused).
2. **AudienceAnalytics panel** — product/web analytics (DAU / retention / sessions / traffic funnel). Belongs
   in an external events pipeline (PostHog/GA + client instrumentation), **not** the transactional DB;
   `audit_log` is too sparse to fake it. Left mock by design.
3. **Rich mock demo surfaces** — the admin staff/managers *directories* stay mock-display because the seed has
   only 1 fully-real staff (Mai); real writes (provision/assign/perf) land in the DB and overlay for display.
   Feeding them fully real would gut the demo to 1 row.
4. **Client-side soft checks** — e.g. affiliate payout min ($50 pre-check) is UX only; the server fn is the
   source of truth.
5. **Ops, not code** — persist `STRIPE_WEBHOOK_SECRET` (dashboard endpoint) for prod; move the in-memory click
   rate-limiter to a durable store if multi-instance; PayPal sandbox (seam ready).

## 11. Key file map

- **Migrations:** `supabase/migrations/*.sql` (append-only, serialized). **pgTAP:** `supabase/tests/*.sql`.
- **Seed:** `supabase/seed.sql` (demo accounts, orders, wallets, tickets, affiliate, country tags).
- **Readers:** `apps/app/src/data/*.server.ts` (RLS-scoped; one per domain).
- **Server actions:** colocated `app/**/**.actions.ts` (call the SECURITY DEFINER fns).
- **Client lazy-fetch hooks:** `lib/useOrderDetail.ts`, `lib/useOrderMessages.ts`.
- **Payment seam:** `lib/payments/provider.ts`; Stripe route `app/api/stripe/webhook/route.ts`;
  affiliate link `app/r/[code]/route.ts`; public checkout `app/api/public/checkout/route.ts`.
- **Auth:** `middleware.ts` (session + role-shell gating + PUBLIC_PREFIXES), `custom_access_token_hook`,
  `handle_new_user`.
- **Every module is catalogued in [CONTRACTS.md](CONTRACTS.md)** (guarded by `pnpm contract-coverage`).

## 12. Verification commands

```bash
# from repo root
pnpm db:reset && docker restart supabase_kong_hevaseo-platform   # pristine DB + refresh gateway
pnpm verify:db                                                   # migrations + 488 pgTAP
pnpm --filter @heva/app test                                    # 378 app unit tests
pnpm --filter @heva/app exec tsc --noEmit                       # types
pnpm contract-coverage                                          # CONTRACTS covers every reader

# durable smoke e2e (auth · RLS · lifecycle · security · money invariant)
J=$(pnpm exec supabase status -o json)
SMOKE_URL=http://127.0.0.1:54321 \
SMOKE_ANON=$(echo "$J" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).ANON_KEY))") \
SMOKE_SVC=$(echo "$J" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).SERVICE_ROLE_KEY))") \
  node apps/app/scripts/smoke.e2e.mjs
```

> **Env gotchas:** gitnexus reindex needs Node 22 (`$HOME/.nvm/versions/node/v22.22.2/bin`).
> `db:reset` wipes data → restart `supabase_kong_hevaseo-platform` or login 502s. Fetch anon/service keys
> from `supabase status -o json` at runtime (don't hand-type). Stripe secrets live only in gitignored
> `apps/app/.env.local`.
