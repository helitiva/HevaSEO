# HevaSEO — Per-Role End-to-End Test Cases

> Full flows per role across every documented feature, with the live layer that proves each. Companion
> to [TEST-PLAN.md](TEST-PLAN.md). Live QA run: 2026-07-01 (app :4455, marketing :4321, pristine seed).
> Layers: **BE** = backend E2E (`apps/app/scripts/e2e`), **UI** = Playwright (`apps/app/e2e-ui`),
> **DB** = pgTAP, **browse** = live browser exploration.

## Anonymous / marketing visitor (apps/web)
1. Home renders, nav + service links work — no console errors. ✅ browse
2. Each service landing page loads (`/audit`, `/keyword-strategy`, `/content`, `/backlink`, `/website-optimization`, `/seo-web-design`, `/indexer`). ✅ browse
3. "Choose {plan}" → `/order/{service}?plan=…` brief form (URL, name, email, package, add-ons). ✅ browse
4. Brief → "Continue to payment" → pay step → **Stripe test card 4242…** → order placed, temp password issued. ✅ browse (verified live: order QO-5385, $39, customer provisioned, invariant holds) ✅ UI ✅ DB
5. Checkout server-prices (client total ignored); unknown service 404; invalid email 400; **privileged email refused 409**. ✅ UI (checkout-api)
6. Existing customer email → order attached, no new password. ✅ UI

## Customer (portal, apps/app)
1. Login `jane@acme.com` → `/dashboard`; wrong password stays on `/login`. ✅ UI
2. Sees ONLY own orders / own customer row; cannot read another customer's order or balance. ✅ BE ✅ DB
3. Dashboard + `/orders` + `/credit` render. ✅ UI
4. **Top up credit** (card/PayPal, mock or Stripe) → balance credited, invoice written; client can't self-credit. ✅ UI (journey) ✅ DB
5. Place an order from dashboard → server-priced, credit debited (create_order). ✅ BE ✅ DB
6. Order lifecycle visibility; cancel refunds 95% + 5% fee. ✅ BE ✅ DB
7. Order thread: post a message (forced non-internal); **never sees internal notes**; can't post on another's order. ✅ BE ✅ DB
8. Docs/broadcasts: sees only customer-audience. ✅ BE ✅ DB
9. Cannot call any privileged/money-in fn (create_order/topup/post_*). ✅ BE ✅ DB

## Staff (apps/app)
1. Login `mai@hevaseo.com` → `/staff`. ✅ UI
2. Money-blind: 0 base orders, no customer_balances/invoices; My Tasks via `orders_mgr`. ✅ BE ✅ DB
3. Advance own assigned order only; forging another's transition blocked. ✅ BE ✅ DB
4. **Submit a deliverable** on own task; admin reviews. ✅ BE (UI journey defensive: submits when task is in a submittable state)
5. Cannot submit on a foreign order; cannot cancel orders. ✅ BE ✅ DB
6. Wallet: own balance == SUM(ledger); request payout ≥$50; below-min rejected. ✅ BE ✅ DB
7. Dispute a penalty; see own penalties only. ✅ BE ✅ DB
8. Docs skill-gated to their audience. ✅ BE ✅ DB

## Manager (apps/app)
1. Login `sofia@hevaseo.com` → `/manager`. ✅ UI
2. `orders_mgr` pod-scoped (own pod staff + unassigned), **value column absent**; no out-of-pod orders. ✅ BE ✅ DB
3. Money-blind across pod (no wallets/values). ✅ BE ✅ DB
4. Pod-manager order-thread participation. ✅ BE ✅ DB
5. Manager wallet own-row + override commission. ✅ DB

## Admin (apps/app)
1. Login `admin@hevaseo.com` → `/admin`; customer blocked from `/admin` (RBAC gate). ✅ UI
2. Sees all orders/customers/staff. ✅ BE ✅ UI
3. Orders board; advance/assign/cancel; review deliverables. ✅ BE ✅ UI
4. **Resolve staff & affiliate payouts** (approve/pay/**reject-refund**) via `/admin/finance?tab=payouts`; reject refunds + invariant holds; no re-resolve. ✅ UI (journey) ✅ BE ✅ DB
5. Penalties apply/waive; payroll run (idempotent per period). ✅ BE ✅ DB
6. Provision staff/manager/affiliate → shadow + **temp-password login** shown; invitee onboards. ✅ BE ✅ DB
7. Author docs/broadcasts by audience. ✅ BE ✅ DB
8. Analytics dashboard renders (real revenue; audience panel = mock by design). ✅ UI (render)

## Affiliate / KOL (apps/app)
1. Login `jane@janeseo.com` → `/affiliate`. ✅ UI
2. Reads own commission wallet/ledger + tier config; updates own profile; sets own code. ✅ BE ✅ DB
3. Request payout ≥ min; admin reject-refund; invariant holds. ✅ BE ✅ DB
4. Referral click tracking via public `/r/:code` (anon); tier pin is admin-only. ✅ BE ✅ DB
5. Cannot mint commission (`post_affiliate_commission` blocked). ✅ BE ✅ DB

## Bugs found during live QA (2026-07-01)
| # | Sev | Where | Finding | Fix |
|---|-----|-------|---------|-----|
| 1 | HIGH | `post_order_message` | participant gate NULL-leak: customer could post on a shadow-customer order | migration `20260701470000` + pgTAP `0670` (found by BE E2E) |
| 2 | — | marketing `OrderShell.astro` | FALSE POSITIVE — I briefly changed the checkout default `:4500 → :4400`, but the app actually runs on `:4500` in this workspace (matches the Stripe webhook forward). Reverted to `:4500`. (The E2E order placement was verified against `:4455`/`PUBLIC_CHECKOUT_URL`, which still holds.) |
| 3 | HIGH | `affiliate/(dash)/layout.tsx` | `/affiliate/settings` 500'd — `useToast must be used within ToastProvider` (provider missing from the affiliate layout) | wrap the affiliate dash in `ToastProvider`; confirmed via per-role console sweep (all 5 roles clean on prod build) |
| 4 | LOW | marketing `index.astro` | `cdn.simpleicons.org/openai` icon 404 (upstream removed) | replaced with a Phosphor `ph-sparkle` icon |
| — | n/a | journeys.spec | 2 test-nav gaps (Payouts tab URL, PayPal locator) — NOT app bugs | test fixes |
| — | env | app dev (turbopack) | intermittent dev-HMR `global-error.js not in Client Manifest` 500 under sweep load (Next 15 turbopack flake; `next build` is clean) — NOT an app bug | run the sweep against `next start` (prod build) |

## Coverage status
- Automated (green): pgTAP 524 · unit 378 · backend E2E 81 · Playwright 20 (auth/surfaces/checkout-api/journeys).
- Live browse: marketing home + service/order pages exercised; app per-role via Playwright (real browser).
- Remaining (follow-up): drive the marketing payment step to final "order placed" in-browser (money path already proven at HTTP+DB); exhaustive per-page browse of every admin sub-tab; visual-regression baselines for authed pages (need data masking).
