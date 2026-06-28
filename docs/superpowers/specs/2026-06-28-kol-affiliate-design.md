# KOL Affiliate Program — Design (Phase-0, mock)

> Status: approved 2026-06-28. Phase-0 = full frontend on mock data; no real backend/auth.
> Scope chosen: **B** — public registration page **+** a rich, detailed affiliate dashboard.
> (Not **C**: affiliate is a self-contained surface, **not** a 5th RBAC role yet.)

## 1. Purpose

Let a KOL/creator self-register as an affiliate, instantly receive a shareable
affiliate **URL + code**, and track the **referral fee** they earn — a commission
on the **order volume** of the customers they refer. A referred customer is tagged
to the affiliate for life, so **repeat orders keep paying** (recurring attribution),
and the commission **rate scales with a tier** based on lifetime referred volume.

## 2. Decisions (locked during brainstorming)

| # | Decision |
|---|----------|
| Scope | Registration page + detailed dashboard (8 sections). No admin-side affiliate management this round. |
| Commission model | **Tiered + recurring/lifetime.** Rate scales with lifetime referred volume; referred customer tagged for life; every qualifying order pays. |
| Approval | **Instant / self-serve.** Submit → link live immediately → straight into the dashboard. |
| Location | **All in `apps/app`** (Next.js). Public join route + a `/affiliate` shell rendered as a fixed demo-KOL persona, like `/staff`. |
| Code | Auto-generated from name **and** editable (vanity code). |
| Money visibility | KOL sees **their own commission only** — never staff payouts, internal margins, or platform take. Same firewall discipline as `lib/staffFinance.ts`. |
| RBAC | No `affiliate` role added to `lib/rbac.ts`. Leave a one-line pointer noting where it would slot in for the future **C** upgrade. |

## 3. Tier table

Tiers keyed on **lifetime referred order volume** (USD). Rate applies to each
qualifying order's value.

| Tier | Lifetime volume ≥ | Rate |
|------|-------------------|------|
| Bronze | $0 | 10% |
| Silver | $5,000 | 15% |
| Gold | $20,000 | 20% |
| Platinum | $50,000 | 25% |

(Numbers are sensible defaults; trivially editable in one constant.)

## 4. Architecture & routes (all in `apps/app`)

```
src/app/affiliate/
  join/page.tsx              PUBLIC registration page (no shell, no persona)
  join/JoinClient.tsx        form + instant success reveal (URL + code)
  layout.tsx                 affiliate shell (fixed demo-KOL persona)
  page.tsx                   dashboard (composes the 8 sections)
  referrals/page.tsx         full referrals table (dashboard shows a preview)
  payouts/page.tsx           ledger + payout history (dashboard shows summary)
  assets/page.tsx            marketing-assets library (dashboard shows a preview)
  settings/page.tsx          profile, payout method, affiliate code (light)
```

The dashboard renders as **one fixed demo-KOL persona**, mirroring how `/staff`
and `/admin` render fixed personas in Phase-0. `/affiliate/join` is standalone
(no shell): submit → success card with the generated URL + code → CTA into the
dashboard.

## 5. Data & logic split (mirrors `lib/` + `data/` convention)

### `src/lib/affiliate.ts` — pure types + math (unit-tested in isolation)

Types: `AffiliateTier`, `Affiliate`, `Referral`, `CommissionEvent`,
`PayoutRequest`, `AffiliateKpis`, `FunnelStats`.

Functions:
- `AFFILIATE_TIERS` — the tier table from §3.
- `tierFor(lifetimeVolume): AffiliateTier`
- `nextTierProgress(lifetimeVolume): { next: AffiliateTier | null; pct: number; remaining: number }`
- `commissionFor(orderValue, tier): number`
- `rollupKpis(referrals, events): AffiliateKpis` — headline numbers + MoM deltas.
- `funnelStats(...)` — clicks → signups → first order → repeat, with rates.
- `genCode(name): string` — vanity code from a name.
- `isCodeValid(code): boolean` — format/length rule (e.g. 3–20, `[A-Z0-9]`).
- `buildAffiliateUrl(code)` / `buildDeepLink(code, servicePath)`.

**Money-leak invariant:** every figure is the affiliate's own commission; the
module never references staff pay, internal margins, or platform take. A
commission number can be reverse-engineered only into the affiliate's own
earnings, never into anyone else's pay.

### `src/data/affiliateMock.ts` — the only file with concrete data

One demo KOL (e.g. *Jane Rivera, @janeseo*), ~6–10 referred customers with order
histories, derived commission events across ~8 months, payout history, and a
marketing-assets list. Exposes small selector helpers (`myAffiliate()`,
`myReferrals()`, `myCommissionEvents()`, `myPayouts()`, `marketingAssets()`).

### `src/data/affiliateNav.ts`

Nav sections: **Overview** · **Referrals** · **Payouts** · **Assets** · **Settings**.

## 6. Components

- `components/affiliate/AffiliateShell.tsx` — sidebar + topbar shell mirroring
  `StaffShell`/`StaffSidebar`/`StaffTopbar`. Fixed demo-KOL identity.
- Dashboard widgets (each focused, reusable on its sub-page):
  - `LinkBar` — URL + code, copy buttons, QR, quick-share, **deep-link builder**
    (pick a service from `SERVICES` → tracked link).
  - `KpiCards` — Clicks · Referred signups · Active referred customers ·
    Total referred volume · Commission lifetime · Commission this month, each
    with a MoM delta.
  - `TierProgress` — current tier + rate, progress bar to next tier, what unlocks.
  - `EarningsChart` — monthly commission + referred-volume trend (SVG, mirrors
    `CashflowChart` pattern).
  - `ConversionFunnel` — clicks → signups → first order → repeat, with rates.
  - `ReferralsTable` — referred customers: joined, # orders, their volume,
    commission generated, status (active/churned). Sortable.
  - `CommissionLedger` — pending vs paid balance, recent commission events,
    payout history, **Request payout** (mock action).
  - `AssetsGrid` — ready-made banners + copy snippets to grab.
- `join/JoinClient.tsx` — the public form + instant success reveal.

Dashboard page shows section 1–8; **Referrals/Payouts/Assets** also get their own
deeper sub-pages, with the dashboard showing a preview/summary that links through.

## 7. Registration form fields

Name · Email · Primary platform + handle (Instagram/TikTok/YouTube/X/Facebook/Blog)
· Audience size (bucketed dropdown) · Niche/category · How you'll promote
(optional free-text) · Desired affiliate code (auto-generated from name, editable)
· Payout method (PayPal/bank/crypto — collected, no real payout) · Agree to terms.

Instant approval: on submit, generate code (validate), reveal URL + code in a
success card with copy buttons and a CTA into the dashboard.

## 8. Styling / conventions

Reuse existing tokens and classes: `border-border`, `bg-card`, `bg-background`,
`text-muted-foreground`, `text-primary`, `brand-500/700`, `.display` font,
`.nav-item`, `.page-anim`; Phosphor icons via `ph-bold ph-*`; `PageHeader`
shared component; `money()` formatting. Charts as inline SVG following
`CashflowChart`. Both light/dark themes must read intentionally.

## 9. Testing

`src/lib/affiliate.test.ts` — unit tests for `tierFor`, `nextTierProgress`,
`commissionFor`, `rollupKpis`, `funnelStats`, `genCode`, `isCodeValid`. Matches
the existing `*.test.ts` convention (e.g. `staffFinance.test.ts`).

## 10. Out of scope (future)

- Admin-side affiliate management (approve/suspend, set custom rates, fraud review).
- Real auth + persistence + click tracking + cookie attribution.
- Promoting affiliate to a first-class RBAC role (the **C** upgrade).
- Lifting the public landing/join into the Astro marketing site for SEO.
