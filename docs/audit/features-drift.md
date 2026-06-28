# FEATURES.md Semantic Drift Audit

> **Purpose:** Human-verified code↔doc drift that a text-matching linter cannot detect.
> **Method:** Read `docs/FEATURES.md` end-to-end; cross-check every material claim against
> the cited source files (greping for symbols, reading implementations). Only verified
> findings are listed below.
> **Scope:** Categories 1–4 as specified in the task brief.
> **Read-only audit:** no source files were changed.

---

## Category 1 — Feature ↔ Role Matrix drift

### WRONG-1 · Catalog — manager row claims `✓ (read-only)`, but manager has NO catalog capability

**Location in FEATURES.md:** §3 matrix, row `**Catalog — view**`, Manager column: `✓ (read-only)`.

**Code says:**
- `lib/rbac.ts` `ROLE_CAPABILITIES.manager` (lines 103–113) lists nine capabilities:
  `manager.access`, `orders.manage`, `assignment.manage`, `review.manage`, `tickets.manage`,
  `customers.manage`, `staff.manage`, `audit.view`, `notes.internal.view`.
  **`catalog.view` is absent.**
- `lib/rbac.ts` `ROUTE_CAPABILITY` has no `/manager/catalog` entry.
- `data/managerNav.ts` comment on line 5 explicitly reads "no Catalog" and the
  `MANAGER_NAV` array contains no catalog link.

**Correction:** Change the Manager cell for `Catalog — view` from `✓ (read-only)` to `✗`.
The `catalog.view` capability exists (admin only, line 92) but the manager role does not hold it.

**Severity:** WRONG

---

### STALE-1 · Staff view-only guards described as "not yet deployed" on tasks/notes/settings

**Location in FEATURES.md:**
- §3 matrix note (lines ~220–221): "Currently `ViewOnlyGuard` is deployed only on `/staff/finance`.
  Task actions, notes CRUD, and settings mutations are **not yet guarded**."
- §6 Known Mock Gaps, item 1 (HIGH): "Task actions (`TaskDetailClient`), notes CRUD
  (`NotesClient`, `NoteFullEditor`), and settings (`SettingsClient`) must also call
  `useStaffViewOnly()`."

**Code says (all confirmed by grep):**
- `apps/app/src/app/staff/tasks/[id]/TaskDetailClient.tsx` lines 13 & 26: imports and calls
  `useStaffViewOnly()`; buttons are disabled/aria-disabled when `viewOnly` is true (line 113–115).
- `apps/app/src/app/staff/notes/NotesClient.tsx` lines 11 & 14: imports and gates all CRUD
  buttons (lines 84, 125, 142–144).
- `apps/app/src/app/staff/notes/NoteFullEditor.tsx` lines 9 & 15: imports; `canSave` is
  `false` when `viewOnly` (line 32).
- `apps/app/src/app/staff/settings/SettingsClient.tsx` lines 12 & 21: imports; every input,
  button, switch, and textarea is `disabled={viewOnly}` (lines 57–212).

**Correction:** Remove item 1 from §6 "HIGH — RBAC / correctness". Update the §3 matrix note
to read: "As of the current codebase, `useStaffViewOnly()` is deployed on
`/staff/finance` (via `ViewOnlyGuard`), `/staff/tasks/[id]` (`TaskDetailClient`),
`/staff/notes` (`NotesClient`, `NoteFullEditor`), and `/staff/settings` (`SettingsClient`)."

**Severity:** STALE

---

### MINOR-1 · Manager money-blind note: `catalog.view` listed among blocked capabilities

**Location in FEATURES.md:** §3 manager money-blind note (line ~218):
"The manager role does NOT hold `finance.view`, `analytics.view`, `pricing.view`,
`affiliate.manage`, `managers.manage`, or `org.settings`."

**Code says:** This list is accurate, but omits that manager also lacks `catalog.view`,
`catalog.manage`, `docs.manage`, `broadcasts.manage`, `admin.access`, and `pricing.view`
(pricing.view is customer-only — staff also lack it, though that's correct context).
The omission of `catalog.view` is particularly relevant given WRONG-1 above.

**Correction:** Add `catalog.view` to the enumerated list of capabilities the manager does NOT hold.

**Severity:** MINOR

---

## Category 2 — Feature ↔ Data Map drift

### WRONG-2 · `Docs — audience gate` row cites `docsStore.ts` for `docsForCustomer/Staff/Manager`

**Location in FEATURES.md:** §5 data map, row `**Docs — audience gate**`:
"`data/docsStore.ts` → `docsForCustomer`, `docsForStaff`, `docsForManager`"

**Code says:**
- `data/docsStore.ts` exports: `isSeedId`, `newDocId`, `todayIso`, `DocsApi`, `useDocs` — no
  audience-gate functions at all.
- The three gate functions live in `data/staffDocs.ts`:
  - `docsForStaff(docs, skills)` — line 422
  - `docsForManager(docs)` — line 425
  - `docsForCustomer(docs)` — line 428

The row immediately below (`Staff docs — skill gate`) correctly cites `data/staffDocs.ts`,
confirming the split: `docsStore.ts` is the admin authoring store; `staffDocs.ts` is the
audience gate.

**Correction:** Change the `Docs — audience gate` data-module column to:
`data/staffDocs.ts` → `docsForCustomer`, `docsForStaff`, `docsForManager`

**Severity:** WRONG

---

### STALE-2 · `Customer dashboard KPIs` row: claims `TODAY frozen` and `on-time % hardcoded`

**Location in FEATURES.md:**
- §5 data map, row `**Customer dashboard KPIs**`:
  "mock — `TODAY` frozen; on-time % hardcoded in JSX"
- §6 item 2 (HIGH): "Customer dashboard frozen/fake — `DashboardTop.TODAY` is a module-scope
  constant; on-time % (96%/100%) is static JSX."

**Code says:**
- `components/DashboardTop.tsx` line 10 comment: "TODAY is intentionally derived at call time
  (inside the component via useMemo) to avoid [freezing]."
- Line 35: `const today = useMemo(() => mockTodayDate(), []);` — derived inside the component,
  not at module scope.
- Lines 163–168: the on-time KPI card displays `—` with a comment
  `/* TODO(backend): derive from real completion data — order records don't carry an onTime flag yet */`
  Not a hardcoded percentage.

**Correction:**
- In §5 data map backend note: change to "mock — on-time rate deferred (returns `—`); `TODAY`
  is computed via `useMemo` inside the component."
- In §6 item 2: update the description — the module-scope TODAY freeze is fixed; the on-time
  KPI now shows `—` awaiting backend data. Downgrade or remove the HIGH severity for this item.

**Severity:** STALE

---

### STALE-3 · `Admin affiliate management` row: `programStats()` described as "runs at module load (frozen)"

**Location in FEATURES.md:** §5 data map, row `**Admin affiliate management**` backend note:
"`programStats()` runs at module load (frozen)"

**Code says:** `data/affiliatePulse.ts` line 74:
`export const programStats = (): ProgramStats => ({ ... });`
This is a function — it returns a fresh object on each call, not a frozen module-scope singleton.

**Note:** `joinOffer` in `data/affiliatePulse.ts` (line 94) IS a function but is called at
module level in `apps/app/src/app/affiliate/join/page.tsx` line 17
(`const offer = joinOffer();`), so the frozen-at-module-load concern applies to `joinOffer`
there, not `programStats`.

**Correction:** Change the note for admin affiliate management to:
"mock — needs backend; `programStats()` is a function (not frozen); `joinOffer()` is called
at module level in `affiliate/join/page.tsx` and WILL freeze at server start."

**Severity:** STALE

---

## Category 3 — Feature descriptions & flows drift

### WRONG-3 · §2.8 Referral tracking: claims `"at-risk"` as a valid referral status

**Location in FEATURES.md:** §2.8 Affiliate/KOL Program, row `Referral tracking`:
"List of referred customers with volume, status (`"active"`, `"at-risk"`, `"churned"`);"

**Code says:** `lib/affiliate.ts` line 100:
`export type ReferralStatus = 'active' | 'churned';`
There are only two statuses. `"at-risk"` does not exist anywhere in the affiliate type system
or mock data (confirmed by grep across all `src/` files — zero hits for `at-risk` as a
`ReferralStatus` value).

**Correction:** Change the status list to: `status ("active", "churned")`.
If churn-risk detection is a planned feature, add a separate note like
"churn alert may be derived from inactivity signals — not yet modelled."

**Severity:** WRONG

---

### MINOR-2 · §2.15 Impersonation: affiliate impersonation completely omitted

**Location in FEATURES.md:** §2.15 Impersonation — only two rows:
admin→customer and admin/manager→staff. No affiliate row.

**Code says:**
- `lib/impersonation.ts` lines 66–88: full affiliate impersonation implementation —
  `IMPERSONATE_AFFILIATE_COOKIE = 'heva_as_affiliate'`, `setAffiliateImpersonation`,
  `clearAffiliateImpersonation`, `readAffiliateImpersonation`, `impersonateAffiliate`.
- `components/admin/PartnerHoverCard.tsx` line 102: "View as partner" button calls
  `impersonateAffiliate(a.id)`.
- `components/admin/affiliate/PartnerDrawer.tsx` line 60: another entry point.
- `lib/currentAffiliate.ts` lines 2–11: reads the cookie to determine which partner's
  data the `/affiliate` portal renders.

**Correction:** Add a third row to §2.15:

| Admin → affiliate impersonation | Admin can view the affiliate portal as any specific partner; cookie-based (`heva_as_affiliate`); no mode flag — always `act` | Button in partner hover card (`PartnerHoverCard`) and partner drawer (`PartnerDrawer`); `lib/impersonation.ts` |

**Severity:** MINOR

---

### MINOR-3 · §3 matrix: `Finance — payout request (staff)` — "view-only guard enforced" in cell is now redundant/misleading

**Location in FEATURES.md:** §3 matrix, row `Finance — payout request (staff)`, Staff column:
`✓ (view-only guard enforced)`.

**Code says:** The `ViewOnlyGuard` on `/staff/finance` was already enforced when the doc was
written. The parenthetical was added to distinguish it from the then-unguarded task/notes/settings
pages. Now that STALE-1 confirms all four surfaces are guarded, the parenthetical reads as a
special note for a no-longer-special situation.

**Correction:** Simplify to `✓` (like the other staff self-service rows), or expand to note the
surface (`✓ — ViewOnlyGuard at page root`) for completeness. The higher-priority fix is removing
the STALE comment in the matrix note and §6 item 1.

**Severity:** MINOR

---

## Category 4 — Coverage (code exists, doc omits or misrepresents)

### MISSING-1 · Manager `catalog.view` gap creates an undocumented surfacing inconsistency

This is the direct corollary of WRONG-1. FEATURES.md §1 "The Five Roles" describes manager as
"same ops actions as admin but money-blind." The matrix row implying catalog read access
(`✓ (read-only)`) follows that framing — but the capability matrix, the nav, and the route map
all agree that managers have NO catalog access at all. The doc should state this explicitly
in the manager role description, not just in the corrected matrix cell.

**Location in FEATURES.md:** §1 roles table, Manager row description + §3 matrix.

**Correction:** Add "no service catalog access" to the manager role description,
and fix the matrix cell as described in WRONG-1.

**Severity:** MISSING

---

### MISSING-2 · Affiliate impersonation omitted from §5 data map

`lib/impersonation.ts` now covers three impersonation flavours (staff, customer, affiliate),
but the §5 data map row `Impersonation` only documents:
"`lib/impersonation.ts`; `lib/currentStaff.ts`; `lib/currentAffiliate.ts`".

The reference to `lib/currentAffiliate.ts` is present but the narrative description
mentions only staff and customer modes. Companion file `lib/currentAffiliate.ts` is already
cited but is unexplained.

**Correction:** Extend the §5 impersonation row description to include affiliate mode:
"Three cookie-based modes: staff (`heva_as` + `heva_as_mode`),
customer (`heva_as_customer`), affiliate (`heva_as_affiliate`);
`currentAffiliate.ts` reads the affiliate cookie to scope the `/affiliate` portal."

**Severity:** MISSING

---

### MISSING-3 · §6 items 1 and 2 are both resolved — the HIGH backlog overstates the debt

Two of the four HIGH items in §6 are now fixed:
- **Item 1** ("Staff view-only guards incomplete") — resolved; see STALE-1.
- **Item 2** ("Customer dashboard frozen/fake") — `TODAY` freeze and hardcoded % both fixed;
  see STALE-2.

Leaving these listed as HIGH gives a false picture of Phase-3 debt to backend engineers
reading the doc.

**Correction:** Either remove items 1 and 2 from §6, or move them to a "resolved" sub-section
so the remaining HIGH items (3 and 4) reflect the actual open backlog.

**Severity:** STALE (systemic, affects planning credibility)

---

## Accurate sections (no drift found)

The following were spot-checked and found to be accurate:

- **Payroll model (§2.5 and §5)** — `effectivePay` in `lib/payOverrides.ts` line 86 returns
  `{ base, ratePct, bonus, commission, gig, total: base + gig + commission + bonus }`. The doc
  formula "base + gig + commission + bonus − penalties" with the per-package resolution order
  matches exactly. The historical-months-gig=0 note is also accurate (`PaySeed.gigCounts` is
  the caller's responsibility).
- **Order lifecycle statuses (§2.1 + §4.1)** — `type OrderStatus` in `adminMock.ts` line 2
  matches the documented `new → confirmed → assigned → in_progress → internal_review →
  delivered → approved/changes_requested → completed` flow.
- **Affiliate tier thresholds and commission rates (§4.3)** — `AFFILIATE_TIERS` in
  `lib/affiliate.ts` lines 22–27 matches the documented Bronze/Silver/Gold/Platinum
  thresholds (0 / 5k / 20k / 50k) and rates (10% / 15% / 20% / 25%) exactly.
- **Manager pod-scoping (§5 managerScope row)** — `lib/managerScope.ts` exports
  `managerScope`, `ordersForPod`, `customersForPod`, `ticketsForPod`, `auditInPod` as documented.
- **Manager scorecard levers (§2.9)** — `lib/managerPerf.ts` `MGR_SCORE_MODEL` defines
  exactly the five levers: delivery, quality, responsiveness, team-health, growth, matching §2.9.
- **RBAC money-blind layers (§3 note)** — four layers (ROLE_CAPABILITIES, ViewerProvider hooks,
  showMoney props, managerPulse/managerPerf derivation) are confirmed present in code.
- **Total route count: 89 (§1)** — `scripts/crawl/routes.json` line 4 `"total": 89` and
  per-role breakdown matches exactly: customer 17, admin 28, manager 20, staff 17, affiliate 7.
- **Staff scorecard model (§5)** — `SCORE_MODEL` in `lib/staff.ts` lines 58–62: quality (0.45),
  on-time (0.35), throughput (0.20). `commissionTierFor` and `improvementLever` exported as cited.
- **`adminAffiliates()` and `adminPayouts()`** — both confirmed exported from `data/adminAffiliate.ts`
  lines 53 and 147 as cited.
- **`programSeries()` in `data/adminAffiliate.ts`** — confirmed, line 160.
- **Docs audience gate in flow diagram (§4.5)** — `docsForCustomer/Staff/Manager` called out in
  the Mermaid diagram; the diagram labels the source as `docsStore` loosely (design intent),
  while the specific gate functions live in `staffDocs.ts` (see WRONG-2 for the data map row).

---

## Summary table

| ID | Severity | Location | Claim | Code reality |
|---|---|---|---|---|
| WRONG-1 | WRONG | §3 matrix — Catalog, Manager col | `✓ (read-only)` | Manager has no `catalog.view` in `ROLE_CAPABILITIES`; no `/manager/catalog` route; not in MANAGER_NAV |
| WRONG-2 | WRONG | §5 data map — Docs audience gate | `data/docsStore.ts → docsForCustomer/Staff/Manager` | These functions are in `data/staffDocs.ts` lines 422–428 |
| WRONG-3 | WRONG | §2.8 Referral tracking | status includes `"at-risk"` | `ReferralStatus = 'active' \| 'churned'` — no at-risk status exists |
| STALE-1 | STALE | §3 matrix note + §6 item 1 (HIGH) | ViewOnlyGuard only on `/staff/finance`; tasks/notes/settings unguarded | All four surfaces now call `useStaffViewOnly()` |
| STALE-2 | STALE | §5 data map + §6 item 2 (HIGH) | `DashboardTop.TODAY` frozen; on-time % hardcoded | TODAY computed via `useMemo`; on-time shows `—` with backend TODO |
| STALE-3 | STALE | §5 data map — admin affiliate mgmt | `programStats()` runs at module load (frozen) | `programStats` is a function called per-request; `joinOffer` is the actual frozen risk |
| MISSING-1 | MISSING | §1 manager role description | "same ops actions as admin but money-blind" | No qualification that catalog is also excluded |
| MISSING-2 | MISSING | §2.15 + §5 impersonation | Only staff and customer modes described | Affiliate impersonation fully implemented (`heva_as_affiliate` cookie, PartnerHoverCard, PartnerDrawer) |
| MISSING-3 | MISSING | §6 HIGH backlog | Items 1 & 2 listed as open HIGH debt | Both are resolved in the current codebase |
| MINOR-1 | MINOR | §3 money-blind note | Lists 6 missing capabilities for manager | `catalog.view` not mentioned in the list |
| MINOR-2 | MINOR | §2.15 Impersonation | No affiliate impersonation row | `lib/impersonation.ts` has full affiliate support |
| MINOR-3 | MINOR | §3 matrix — Finance payout, Staff col | `✓ (view-only guard enforced)` parenthetical | Guard is enforced, but now it's no different from any other guarded surface |

**Totals: 3 WRONG · 3 STALE · 3 MISSING · 3 MINOR**

*Audited by semantic-drift-audit pass, 2026-06-28. Source: `lib/rbac.ts`, `data/staffDocs.ts`, `data/docsStore.ts`, `lib/affiliate.ts`, `data/affiliatePulse.ts`, `components/DashboardTop.tsx`, `app/staff/tasks/[id]/TaskDetailClient.tsx`, `app/staff/notes/NotesClient.tsx`, `app/staff/notes/NoteFullEditor.tsx`, `app/staff/settings/SettingsClient.tsx`, `lib/impersonation.ts`, `components/admin/PartnerHoverCard.tsx`, `components/admin/affiliate/PartnerDrawer.tsx`, `scripts/crawl/routes.json`.*
