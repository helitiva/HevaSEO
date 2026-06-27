# Staff Finance page — design

Date: 2026-06-27
Status: approved (brainstorm) → implementing
Surface: staff portal (`/staff`), Phase 0 (frontend on mock; no backend)

## Goal

Give each staff member a single Finance page that shows their own pay, lets them
**request payouts** of earned commission, and surfaces **penalties** (fines) for
things like too many revision rounds. Build entirely on mock data, consistent with
the existing money-leak-safe `staffMock` layer.

## Decisions (from brainstorm)

- **Pay model = Hybrid.** Base salary is admin-driven payroll paid on schedule
  (unchanged, from `BASE_SALARY` / admin Payouts tab). Commission accrues into a
  **withdrawable wallet** the staffer requests payouts from. Penalties debit the
  wallet, never the base salary.
- **Penalty types (all 4):** `revision` (excess revision rounds), `late`
  (missed deadline), `rating` (low QA/customer rating), `manual` (admin-applied).
- **Penalty lifecycle:** rules **auto-flag** → penalty `pending` → admin
  confirms (`applied`, debits wallet) or `waived`. Staff can `dispute`.
- **Penalty sizing (all 3, configurable per rule):** `pct` (% of the task's
  commission), `flat` (fixed fee), `progressive` (escalates by repeat count).
- **Layout = Wallet-hero (stacked):** hero → KPI strip → earnings trend →
  tabbed detail panel.

## Information architecture

- New nav item `Finance` in the **"Me"** section of `staffNav.ts` →
  route `/staff/finance`, icon `ph-wallet`.
- **My Day** keeps its small earnings glance, now deep-linking to `/staff/finance`.
- **Performance** sheds its earnings card + earnings-history chart (they move to
  Finance); it stays focused on ratings / first-pass / work history. No duplication.

## Page layout (Wallet-hero, stacked)

1. **Hero** — left: *Commission wallet* balance + `Request payout`; right: *Base
   salary $/mo* + *next payday* + *clearing* sub-line.
2. **KPI strip (4)** — This-month take-home · YTD · First-pass rate ·
   **Pending fines** (amber when > 0).
3. **Earnings trend** — 6-month bars (reuses `earningsHistory`), base/commission/
   bonus, fines shown as a dip.
4. **Tabbed detail panel** — `Activity` (unified ledger) · `Penalties` ·
   `Payslips` · `Payouts`.

## Data model (added to `staffMock.ts`)

All amounts derive from **commission** — never customer price / order value.

- `StaffPenalty` — `{ id, type, taskCode, reason, sizing, amount,
  status: 'pending'|'applied'|'waived'|'disputed', createdAt, by }`.
- `PenaltyRule` — `{ type, threshold, sizing, value, enabled }`. Drives
  auto-flagging; seeded so the demo shows real flags derived from existing
  `reworkCount()` / `onTime` history.
- `PayoutRequest` — `{ id, amount, method, status:
  'requested'|'approved'|'paid'|'rejected', requestedAt, note }`.
- `PayoutMethod` — `{ id, kind: 'bank'|'paypal'|'wise', label, last4, isDefault }`.
- `WalletEntry` — derived union of commission credits, applied penalty debits, and
  payouts → one sorted, filterable ledger.
- Selectors: `myWallet()`, `myPenalties()`, `myPayouts()`, `myPayoutMethods()`,
  `walletLedger()`. Wallet balance = credits − applied penalties − (paid + requested) payouts.

## Penalty lifecycle (centerpiece)

- Rules auto-flag → penalty created `pending`. Staff sees it in the Penalties tab +
  amber KPI, with the triggering rule and the task it's tied to.
- Staff can **Dispute** (SlideOver note → `disputed`); admin confirms → `applied`
  (wallet debit) or **waives** → `waived`.
- No backend: confirm/waive/dispute are **local session overrides**, mirroring the
  admin Payouts tab's salary edits. Balance recomputes from `applied` entries only;
  `pending` never affects balance.

## Payout request flow

- `Request payout` opens a SlideOver: amount (≤ available, min threshold), method
  picker, optional note → creates a `requested` PayoutRequest; balance shows it as
  pending. Method management (add / set default) in the Payouts tab. Per-method fee
  + clearing note shown (Fiverr/Upwork pattern).

## Safety invariant (carried over)

Page shows commission / bonus / base / take-home only — never `basis` / `rate` /
order value. Penalty amounts are % *of commission*, so customer price can't be
reverse-engineered. Preserves the compile-time money-free guarantee `staffMock`
was built around.

## Testing

Vitest, alongside `staffPhase2.test.ts`:
- wallet balance = credits − applied penalties − paid/requested payouts;
- penalty sizing math for `pct` / `flat` / `progressive`;
- `pending` fines never change balance;
- leak test: Finance selectors never expose `basis` / `rate`.

## Out of scope

Real payment rails, tax documents, multi-currency, admin-side penalty review UI
(staff-facing only for now; admin confirm is mocked).
