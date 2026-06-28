# Audit — Affiliate surface (7 routes)

Code-read audit against [RUBRIC.md](./RUBRIC.md). `[live]` items still need a dev-server pass.
Affiliates **are** allowed to see their own commission/earnings (money-blind applies to *managers*,
not partners), so finance display here is correct by design.

Data spine: `data/affiliatePortal.ts` (`portalDataFor(id)`) · `lib/affiliate.ts` (tiers, rollups,
projections) · `lib/currentAffiliate.ts` (impersonation-aware persona) · `data/affiliatePulse.ts`
(public program stats) · shared `components/broadcast/InboxClient`.

---

## affiliate · /affiliate (overview)  ·  Verdict: strong
**Source:** `app/affiliate/(dash)/page.tsx`
### Pros
- Genuinely adaptive: new partner (no referrals) gets a link-first hero + "how it works"; active
  partner gets momentum → KPIs → link. Real hierarchy decision, not a static dashboard.
- Clear data flow: one `portalDataFor` call, derived values computed in render (no effect-derived state).
### Cons
- [LOW] `TODAY` is a hardcoded mock anchor (`'2026-06-28'`). Fine for Phase-0 but must become
  `new Date()` (or a server clock) before backend — flag in DATA-MODEL.
- [LOW] Decorative `<i className="ph-…">` icons lack `aria-hidden` (systemic across the surface).
### Recommended fixes
1. Centralize the "today" anchor in one place so all affiliate pages swap to a real clock together.

## affiliate · /affiliate/assets  ·  Verdict: ok
**Source:** `app/affiliate/(dash)/assets/page.tsx`
### Pros
- Consistent `PageHeader`, a motivating conversion nudge, delegates to `AssetsGrid`.
### Cons
- [MEDIUM] "3× more" stat is hardcoded copy, not from data — looks authoritative but isn't sourced.
- [LOW] `[live]` confirm `AssetsGrid` empty/copy-to-clipboard states.
### Recommended fixes
1. Source the multiplier from `affiliatePulse` (or mark it clearly as illustrative).

## affiliate · /affiliate/inbox  ·  Verdict: weak (consistency)
**Source:** `app/affiliate/(dash)/inbox/page.tsx`
### Cons
- [MEDIUM] No `PageHeader` and **no `metadata` title** — every other affiliate route has both. Bare
  `<InboxClient />` breaks the surface's visual rhythm and the browser-tab title.
### Recommended fixes
1. Wrap in a `PageHeader title="Inbox"` section + add `export const metadata`.

## affiliate · /affiliate/payouts  ·  Verdict: strong
**Source:** `app/affiliate/(dash)/payouts/page.tsx`
### Pros
- Tier-upside nudge is computed from real `lifetimeVolume`/`pending` (`nextTierUpside`, `tierFor`),
  not hardcoded — exactly the pattern the assets page should copy.
### Cons
- [LOW] `[live]` confirm `CommissionLedger` (non-compact) empty state when a partner has zero events.

## affiliate · /affiliate/referrals  ·  Verdict: strong
**Source:** `app/affiliate/(dash)/referrals/page.tsx`
### Pros
- "Slipping away" churn alert is derived from `status === 'churned'` and pluralized correctly — good
  retention UX.
### Cons
- [LOW] Alert leans on rose color + icon; text carries the meaning so it passes, but `[live]` verify contrast.

## affiliate · /affiliate/settings  ·  Verdict: ok (needs deeper read)
**Source:** `app/affiliate/(dash)/settings/page.tsx` + `SettingsClient.tsx`
### Cons
- [MEDIUM] `SettingsClient` not yet read — verify input validation (payout method, code change rules)
  and that the affiliate **code is not freely editable** (it's a referral key; collisions matter).
### Recommended fixes
1. Read `SettingsClient.tsx`; confirm validation + immutable/uniqueness handling of the code.

## affiliate · /affiliate/join (public)  ·  Verdict: ok
**Source:** `app/affiliate/join/page.tsx` + `JoinClient.tsx`
### Pros
- Strong editorial landing: social proof, tier strip, time-boxed offer, two-column pitch/form.
### Cons
- [MEDIUM] **Module-scope data reads**: `const stats = programStats()` and `const offer = joinOffer()`
  run once at module load, not per request. The "paid out last month" numbers and the **"Ends in"
  countdown target** freeze for the server's lifetime. Move both inside the component for per-request
  freshness (and so the countdown is honest).
- [LOW] `h-screen overflow-y-auto` wrapper — `[live]` check no double-scrollbar vs. the app shell on mobile.
### Recommended fixes
1. Move `programStats()` / `joinOffer()` calls into the component body.
2. `[live]` verify mobile (375) layout + countdown behavior.

---

## Surface summary
- **Strengths:** data-derived nudges (payouts/referrals/overview) are a model the rest of the app
  should follow; adaptive overview is the standout.
- **Systemic:** decorative icons need `aria-hidden`; one hardcoded "today" anchor; a couple of
  authoritative-looking hardcoded stats.
- **Top fixes (Phase 3):** (1) inbox PageHeader+metadata parity · (2) join module-scope reads →
  per-request · (3) settings code validation · (4) source/flag hardcoded stats.
- **Backend notes for DATA-MODEL:** entities = Affiliate(code, payoutLabel, tier), Referral(customer,
  volume, status), CommissionEvent(amount, status, date), Payout, Click; "today" + program stats must
  become live queries.
