# DATA-ACCESS.md — Mock → DB Cutover Contract

The single authoritative guide for replacing every `lib/` and `data/` mock body with a
Supabase query **without touching the call site**. Read this before touching a domain in
phases B4–B9.

---

## 1. The Cutover Recipe (stated once, applied per domain)

Each domain migration follows these exact steps:

1. **Keep the exported name, signature, and return shape identical.** Pages import these
   functions and must not change. If a signature must change to model the DB correctly,
   that is a **frontend change** — stop, document it here, and get sign-off before
   proceeding (see §1.4).

2. **Replace the mock body with a server-side Supabase query.** Move the function to a
   server-only module (see §4). The new body calls `createClient()` (server), executes
   the query, maps rows to the same shape the mock returned, and throws or returns `null`
   on not-found.

3. **Mock interfaces become row/DTO types.** The TypeScript interfaces declared alongside
   mock data (`AdminOrder`, `StaffDoc`, `StaffInsight`, etc.) already match the DB schema
   shape. Reuse them as the DTO type; the column names from the schema map 1:1 or with
   trivial camelCase conversion.

4. **RLS does the authz; queries stay simple.** Every query runs as the authenticated
   session user. Row-Level Security policies enforce pod-scope, money-blindness, and
   per-role visibility at the DB level. The query itself does not need `WHERE role = ?`
   guards — it just selects what the user is allowed to see. (See `RLS.md` for the policy
   map.)

5. **One domain at a time; unconverted domains keep using mock data.** The mock import
   and the Supabase query can coexist in the same build. Swap the body, run the test
   suite, verify the page renders identically, then commit and stop.

### 1.1 Server-only constraint

Query modules live in `apps/app/src/server/` (or co-located `*.server.ts` files). They
import from `@/lib/supabase/server` (not the browser client). They are never imported by
Client Components — add `import 'server-only'` at the top of every query module to
enforce this at build time.

```typescript
// apps/app/src/server/queries/orders.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
```

### 1.2 Error handling contract

All query functions:
- Return `null` (not throw) when a row is not found.
- Throw a typed `DataAccessError` for unexpected DB errors (caught at the Server
  Component boundary and shown as a proper error page).
- Never leak internal Postgres error messages to the client.

### 1.3 Date anchor replacement

Every `MOCK_TODAY`, `POD_TODAY`, and hardcoded ISO literal must be replaced with
`CURRENT_DATE` in the SQL (or `new Date().toISOString().slice(0, 10)` in TypeScript
when the date is used for in-memory filtering after a query). Never pass a "today"
constant into a query function — the DB clock is the source of truth.

### 1.4 Signature change flags (stop here if you hit one)

| Function | Potential change | Verdict |
|---|---|---|
| `buildPayrollPeriods(gran)` | Mock generates 12-month history from seeded data; DB query needs a `periodFrom` param to bound the window | **Flag** — add optional `from?: string` param, default to 12 months back; frontend passes nothing, stays compatible |
| `portalDataFor(id)` | Returns synthesized data for non-Jane affiliates; DB replaces synthesis with real rows | No signature change — shape stays identical |
| `currentStaffId()` / `currentAffiliateId()` | Already cookie-based; replace cookie lookup with Supabase Auth session | No signature change |
| `effectivePay(seed, ov?)` | Pure math, no DB reads — stays unchanged | No change |
| `managerScope(managerId)` | Replace mock array filters with DB joins; `ManagerScope` shape unchanged | No signature change |

---

## 2. Read Path — Builder → Query Map

### 2.1 Domain: Orders & Catalog (Phase B4)

| Function (signature) | Returns | Supabase query sketch | Notes |
|---|---|---|---|
| `buildOrderDetailProps(id: string)` | `OrderDetailProps \| null` | `SELECT o.*, c.*, obf.*, oa.*, ob.*, d.* FROM orders o JOIN customers c … WHERE o.id = $1` with sub-selects for brief_fields, addons, bundle, deliverables, audit_events | Multi-join; see §2.1 example below |
| `packagePrice(service, pkg)` | `number \| undefined` | `SELECT price FROM catalog_packages WHERE service_id=$1 AND name=$2 LIMIT 1` | Pure catalog read; no RLS needed beyond authenticated |
| `servicePriceRange(service)` | `[number,number] \| undefined` | `SELECT MIN(price), MAX(price) FROM catalog_packages WHERE service_id=$1` | |
| `gigRateOf(service, pkg?, gigRates?, gigPkgRates?)` | `number` | Pure math using overrides (see `pay_overrides` table); fallback to `SELECT gig_rate FROM catalog_packages WHERE service_id=$1 AND name=$2` | Overrides come from server-side `pay_overrides` table (see §3) |

#### Example — `buildOrderDetailProps`

```typescript
// apps/app/src/server/queries/orders.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrderDetailProps } from '@/app/admin/orders/[id]/OrderDetailClient';

export async function buildOrderDetailProps(id: string): Promise<OrderDetailProps | null> {
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers!inner(id, name, company, email, status, tier, spend, balance),
      brief_fields:order_brief_fields(label, value, full, sort),
      addons:order_addons(addon_name, tier, price),
      bundle_children:order_bundle!parent_order_id(child_order_id),
      deliverables(id, version, kind, file_name, url, note, status, submitted_at, reviewed_at, review_note, staff_id),
      service:catalog_services!inner(id, skill_id)
    `)
    .eq('id', id)
    .single();

  if (error || !order) return null;

  // Eligible staff: skill-matched, ranked by composite then lightest load.
  const { data: eligible } = await supabase
    .from('staff')
    .select('name, composite, quality, on_time, capacity, skills, (SELECT count(*) FROM orders WHERE staff_id=staff.id AND status IN (...))')
    .contains('skills', [order.service.skill_id])
    .eq('active', true)
    .order('composite', { ascending: false });

  // Audit timeline for this order.
  const { data: audit } = await supabase
    .from('audit_events')
    .select('id, at, action, change')
    .eq('entity', 'order')
    .eq('entity_id', id)
    .order('at', { ascending: true });

  // Prev/next navigation (cheapest: adjacent row by created_at).
  const { data: adjacent } = await supabase.rpc('order_adjacent', { order_id: id });

  return mapToOrderDetailProps(order, eligible ?? [], audit ?? [], adjacent);
}
```

### 2.2 Domain: Staff Work (Phase B5)

| Function (signature) | Returns | Supabase query sketch | Notes |
|---|---|---|---|
| `currentStaffId()` | `Promise<string>` | Replace mock cookie fallback with `supabase.auth.getUser()` → look up `staff.user_id` | Already async; shape unchanged |
| `currentStaffIdentity()` | `Promise<StaffIdentity>` | Same as above + `SELECT id, name, role_title FROM staff WHERE user_id=$1` | `impersonated` comes from presence of `heva_as` cookie vs. session user |
| `nextStaffActions(status)` | `StaffAction[]` | Pure function — no DB; stays in `lib/staff.ts` | |
| `bumpVersion(subs)` | `number` | Pure function — no DB; stays in `lib/staff.ts` | |
| `daysToDue(deadline, today?)` | `number \| null` | Pure function — no DB | Replace `TODAY` constant with `new Date().toISOString().slice(0,10)` |
| `workStats(items)` | `WorkStats` | Pure aggregation over `WorkItem[]`; DB feeds the items list | Stays in `lib/staff.ts`; callers fetch items from DB first |
| `scoreBreakdown(inputs, composite)` | `ScoreBreakdown` | Pure math — no DB | |
| `improvementLever(stats)` | `Lever \| null` | Pure math — no DB | |
| `rankByComposite(team, id)` | `TeamRank \| null` | Query: `SELECT id, composite FROM staff ORDER BY composite DESC` → pure rank fn stays | |
| `triageForPod(scope)` | `TriageItem[]` | See manager domain (§2.5) | |

### 2.3 Domain: Finance & Payroll (Phase B6)

| Function (signature) | Returns | Supabase query sketch | Notes |
|---|---|---|---|
| `effectivePay(seed, ov?)` | `{base,ratePct,bonus,commission,gig,total}` | Pure math; `seed` comes from `payroll_records` row; `ov` from `pay_overrides` table | No signature change; DB feeds the inputs |
| `buildPayrollPeriods(gran)` | `PayPeriod[]` | `SELECT s.id, s.name, s.role, s.active, pr.period_month, pr.base, pr.gig, pr.commission, pr.bonus FROM payroll_records pr JOIN staff s … GROUP BY period` + applied penalties join | Transaction-heavy on write side; read is straightforward |
| `currentPenalties(staffId, month?)` | `CurrentPenalty` | `SELECT status, SUM(amount) FROM staff_penalties WHERE staff_id=$1 AND date_trunc('month',created_at)=$2::date GROUP BY status` | Replace hardcoded `month='2026-06'` with `CURRENT_DATE`'s month |
| `summarisePenalties(penalties, month)` | `PenaltySummary` | Pure aggregation over `StaffPenalty[]`; DB feeds the list | Stays in `lib/staffFinance.ts` |
| `buildLedger(credits, penalties, payouts)` | `WalletEntry[]` | Pure merge; DB feeds the three lists from `commission_events`, `staff_penalties`, `staff_payout_requests` | Stays in `lib/staffFinance.ts` |
| `walletBalance(credits, penalties, payouts)` | `number` | Pure math over DB-fetched lists | |
| `availableToWithdraw(credits, penalties, payouts)` | `number` | Pure math | |

#### Example — finance data feed for `effectivePay`

```typescript
// apps/app/src/server/queries/finance.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PaySeed } from '@/lib/payOverrides';

export async function staffPaySeed(staffId: string): Promise<PaySeed | null> {
  const supabase = await createClient();
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  const { data: pr } = await supabase
    .from('payroll_records')
    .select(`
      base, rate, bonus, basis,
      gig_counts:payroll_gig_counts(service, pkg, count)
    `)
    .eq('staff_id', staffId)
    .eq('period_month', month)
    .single();

  if (!pr) return null;

  return {
    base: pr.base,
    rate: pr.rate,
    basis: pr.basis,
    bonus: pr.bonus,
    gigCounts: pr.gig_counts,
  };
}

// In the Server Component:
// const seed = await staffPaySeed(staffId);
// const override = await getPayOverride(staffId);  // from pay_overrides table
// const pay = seed ? effectivePay(seed, override) : null;
```

### 2.4 Domain: Affiliate (Phase B7)

| Function (signature) | Returns | Supabase query sketch | Notes |
|---|---|---|---|
| `portalDataFor(id: string)` | `PortalData` | `SELECT * FROM affiliates WHERE id=$1` + `affiliate_referrals` + `commission_events` + `affiliate_payout_requests` joins | See §2.4 example below; no more synthesis |
| `currentAffiliateId()` | `Promise<string>` | `supabase.auth.getUser()` → `SELECT id FROM affiliates WHERE user_id=$1` | Replaces cookie-only lookup with real auth |
| `tierFor(lifetimeVolume)` | `AffiliateTier` | Pure math over `AFFILIATE_TIERS` — no DB | Tiers are admin-editable; fetch from `affiliate_tier_configs` on startup or cache per request |
| `rollupKpis(referrals, events, clicks)` | `AffiliateKpis` | Pure aggregation over DB-fetched lists | Function stays in `lib/affiliate.ts` |
| `monthlySeries(events)` | `MonthPoint[]` | Pure aggregation | |
| `earningStreak(events)` | `number` | Pure math | |
| `funnelStats(input)` | `FunnelStage[]` | Pure math; `clicks` from `affiliate_clicks` table aggregate | |

#### Example — `portalDataFor`

```typescript
// apps/app/src/server/queries/affiliate.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PortalData } from '@/data/affiliatePortal';

export async function portalDataFor(id: string): Promise<PortalData | null> {
  const supabase = await createClient();

  // RLS ensures the affiliate can only fetch their own row.
  const { data: aff } = await supabase
    .from('affiliates')
    .select('*')
    .eq('id', id)
    .single();

  if (!aff) return null;

  const [{ data: referrals }, { data: events }, { data: payouts }, { count: clicks }] =
    await Promise.all([
      supabase.from('affiliate_referrals')
        .select('*, orders:commission_events(order_code, order_value)')
        .eq('affiliate_id', id),
      supabase.from('commission_events')
        .select('*')
        .eq('affiliate_id', id)
        .order('at', { ascending: false }),
      supabase.from('affiliate_payout_requests')
        .select('*')
        .eq('affiliate_id', id)
        .order('at', { ascending: false }),
      supabase.from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .eq('affiliate_id', id),
    ]);

  return {
    affiliate: mapAffiliate(aff),
    referrals: (referrals ?? []).map(mapReferral),
    events: (events ?? []).map(mapEvent),
    payouts: (payouts ?? []).map(mapPayout),
    clicks: clicks ?? 0,
  };
}
```

### 2.5 Domain: Manager (Phase B5 / B4 overlap)

| Function (signature) | Returns | Supabase query sketch | Notes |
|---|---|---|---|
| `managerScope(managerId)` | `ManagerScope` | `SELECT s.* FROM staff s WHERE s.manager_id=$1` + derive `customerCompanies` and `orderCodes` from joined orders | Replace mock array filters; RLS enforces pod boundary at DB level |
| `ordersForPod(scope)` | `AdminOrder[]` | `SELECT * FROM orders WHERE staff_id = ANY($staffIds) AND staff_id IS NOT NULL` | |
| `customersForPod(scope)` | `AdminCustomer[]` | `SELECT * FROM customers WHERE id = ANY($customerIds)` | |
| `ticketsForPod(scope)` | `AdminTicket[]` | `SELECT * FROM tickets WHERE (assignee_id = ANY($staffIds)) OR (assignee_id IS NULL AND customer_id = ANY($customerIds))` | |
| `triageForPod(scope)` | `TriageItem[]` | Derived from pod orders + deliverables + tickets — same logic, DB feeds the inputs | Pure derivation stays in `lib/managerPulse.ts`; DB feeds the raw lists |
| `qaHealth(scope)` | `QaHealth` | `SELECT status, reviewed_at, submitted_at FROM deliverables WHERE staff_id = ANY($staffIds)` then pure aggregation | |
| `slaHealth(scope)` | `SlaHealth` | `SELECT status, sla_tier, created_at FROM tickets WHERE …` + `SLA_LIMIT_H` from `settings_sla` table | |
| `weekDeadlines(scope)` | `{days,overdue}` | Orders with deadlines in `[monday, sunday]` of current week — `CURRENT_DATE` replaces `POD_TODAY` | |
| `rosterWithRebalance(scope)` | `{roster,rebalance}` | `SELECT s.*, count(o.id) as load FROM staff s LEFT JOIN orders o ON o.staff_id=s.id AND o.status IN (…) WHERE s.manager_id=$1 GROUP BY s.id` | |
| `recentActivity(scope, limit?)` | `AuditEntry[]` | `SELECT * FROM audit_events WHERE entity IN ('order','deliverable','ticket','staff') AND entity_id = ANY(…) AND action NOT IN (money actions) ORDER BY at DESC LIMIT $limit` | Money-blind: SQL WHERE on `action` column replaces `isMoneyEvent()` check |
| `buildManagerPerf(managerId)` | `ManagerPerf \| null` | Aggregate over pod staff scores + deliverable stats + ticket latency + leave latency | Most complex manager query; see §2.5 note |
| `allManagerPerf()` | `ManagerPerf[]` | Same as above for all managers; used for rank benchmark | One query per manager or a CTE-based single query |
| `companyBenchmark(perfs?)` | `CompanyBenchmark` | Derived from `allManagerPerf()` — pure math | |

> **Note on `buildManagerPerf`:** This builder aggregates five independent signals
> (delivery, quality, responsiveness, team-health, growth). Each lever maps to a
> different set of tables. The cleanest DB implementation uses a Postgres function
> (or stored procedure) that computes `ManagerStats` in one round-trip, then the
> TypeScript layer applies `leverScores()` and `MGR_SCORE_MODEL` weights (pure math
> that stays in `lib/managerPerf.ts`). This is the hardest builder to reproduce from
> SQL because `growthSlope` currently uses `staff.trend[]` (a mock-only synthetic
> field); the DB replacement must compute slope from real `deliverable` counts over time.

### 2.6 Domain: Docs & Notes (Phase B8)

| Function (signature) | Returns | Supabase query sketch | Notes |
|---|---|---|---|
| `docsForStaff(docs, skills)` | `StaffDoc[]` | `SELECT d.* FROM docs d JOIN doc_audiences da ON da.doc_id=d.id WHERE da.audience IN ('general', …$skills) AND d.active=true ORDER BY d.pinned DESC, d.updated_at DESC` | RLS: staff sees only their skill-scoped + general docs |
| `docsForManager(docs)` | `StaffDoc[]` | `SELECT d.* FROM docs d JOIN doc_audiences da … WHERE da.audience IN ('manager','general')` | |
| `docsForCustomer(docs)` | `StaffDoc[]` | `SELECT d.* FROM docs d JOIN doc_audiences da … WHERE da.audience = 'customer'` | |
| `docForStaff(docs, id, skills)` | `StaffDoc \| undefined` | Same as above + `WHERE d.id=$1` | Returns undefined (→ `notFound()`) when the doc doesn't exist OR audience mismatch |
| `docForManager(docs, id)` | `StaffDoc \| undefined` | Same pattern | |
| `docForCustomer(docs, id)` | `StaffDoc \| undefined` | Same pattern | |

#### Example — `docsForStaff`

```typescript
// apps/app/src/server/queries/docs.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { StaffDoc } from '@/data/staffDocs';

export async function docsForStaff(skills: string[]): Promise<StaffDoc[]> {
  const supabase = await createClient();
  const audiences = ['general', ...skills];

  const { data, error } = await supabase
    .from('docs')
    .select(`
      *,
      audiences:doc_audiences(audience),
      resources:doc_resources(kind, url, label)
    `)
    // Audience filter: the doc must have at least one audience in the viewer's permitted set.
    // Supabase filter on a joined table: use a subquery or RPC.
    .eq('active', true)
    .in('doc_audiences.audience', audiences)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) throw new DataAccessError('docs.forStaff', error);
  return (data ?? []).map(mapDoc);
}
// Note: the audience join filter is cleaner as a Postgres RPC:
//   SELECT DISTINCT d.* FROM docs d
//   JOIN doc_audiences da ON da.doc_id = d.id
//   WHERE da.audience = ANY($1) AND d.active = true
//   ORDER BY d.pinned DESC, d.updated_at DESC
```

Notes are a private-notebook table with `owner_id = auth.uid()`. RLS enforces isolation.
The CRUD for notes is simpler:

```sql
-- Fetching own notes (RLS does the rest):
SELECT * FROM notes WHERE owner_role = $1 ORDER BY pinned DESC, updated_at DESC;
```

### 2.7 Domain: Broadcasts (Phase B8)

| Function | Returns | Supabase query sketch | Notes |
|---|---|---|---|
| `broadcastsForAudience(audience)` | `Broadcast[]` | `SELECT b.* FROM broadcasts b JOIN broadcast_audiences ba ON ba.broadcast_id=b.id WHERE ba.audience=$1 AND b.active=true AND (b.publish_at IS NULL OR b.publish_at <= now()) AND (b.expires_at IS NULL OR b.expires_at > CURRENT_DATE)` | RLS + filter |
| `broadcastReceipt(userId, broadcastId)` | `BroadcastReceipt` | `SELECT * FROM broadcast_receipts WHERE user_id=$1 AND broadcast_id=$2` | Upserted on first delivery |
| `unreadCount(userId, audience)` | `number` | `SELECT count(*) FROM broadcasts b JOIN broadcast_audiences ba … LEFT JOIN broadcast_receipts br ON br.broadcast_id=b.id AND br.user_id=$1 WHERE br.id IS NULL OR br.read=false` | |

### 2.8 Domain: Customers (Phase B4)

| Function | Returns | Supabase query sketch | Notes |
|---|---|---|---|
| `customerSignals(idOrName)` | `CustomerSignals \| null` | `SELECT c.*, count(o.id) filter(WHERE o.status IN (active)), count(t.id) filter(WHERE t.status IN ('open','pending')) FROM customers c LEFT JOIN orders o … LEFT JOIN tickets t … WHERE c.id=$1 OR c.company=$1 GROUP BY c.id` | Multi-join; sub-selects for service mix and staff care |
| `resolveCustomerId(idOrName)` | `string \| null` | `SELECT id FROM customers WHERE id=$1 OR company=$1 OR name=$1 LIMIT 1` | |

### 2.9 Domain: Staff Insight (Phase B6)

| Function | Returns | Supabase query sketch | Notes |
|---|---|---|---|
| `buildStaffInsight(staffId)` | `StaffInsight \| null` | Composite of 8+ sub-queries (staff row, payroll record, penalties, payout requests, payout methods, deliverable history, commission events, rewards) | Hardest single builder; see note below |
| `rosterSignals(staffId)` | `StaffRosterSignals \| null` | Lightweight: `staff` row + `COUNT(orders)` for active/overdue/dueSoon | Used in list views; must be cheap |
| `resolveStaffId(idOrName)` | `string \| null` | `SELECT id FROM staff WHERE id=$1 OR name=$1 LIMIT 1` | |

> **Note on `buildStaffInsight`:** This builder returns the widest DTO in the codebase
> (`StaffInsight` has ~30 fields across 8 concerns). The DB implementation should use a
> Supabase RPC (`build_staff_insight(staff_id)`) that fetches all sub-queries in one DB
> round-trip using CTEs, then the TypeScript layer applies the pure scoring math. The
> `activity` field (bucketed `ActivityBucket[]` per `Granularity`) requires a
> `date_trunc`-based aggregate that is easiest to compute in SQL. The `trend` field is
> currently a hand-authored `number[]` on the staff row — the DB stores this as a
> `numeric[]` column and a trigger recomputes it when monthly deliverable counts change.

---

## 3. Write Path — Server Action Surface

All mutations are Next.js Server Actions (`'use server'`). Every action:
1. Parses input with Zod before touching the DB.
2. Authenticates via `supabase.auth.getUser()` and checks role.
3. Relies on RLS for row-level authorization.
4. Emits an `audit_events` row for every state-changing operation.
5. Runs in a Postgres **transaction** for money operations (marked ★).

### 3.1 Orders

| Action | Zod input sketch | Tables written | Tx? |
|---|---|---|---|
| `placeOrder(input)` | `{serviceId, pkg, customerId, brief[], addons[], projectId?, note?}` | `orders`, `order_brief_fields`, `order_addons`, `order_bundle` | No |
| `transitionOrderStatus(id, status)` | `{orderId: z.string(), status: OrderStatus}` | `orders.status`, `audit_events` | No |
| `assignOrder(id, staffId)` | `{orderId, staffId}` | `orders.staff_id`, `orders.assigned_at`, `audit_events` | No |
| `setOrderPriority(id, priority)` | `{orderId, priority: z.enum(['low','med','high'])}` | `orders.priority` | No |
| `cancelOrder(id)` | `{orderId}` | `orders.status = 'canceled'` | No |

### 3.2 Staff Work

| Action | Zod input sketch | Tables written | Tx? |
|---|---|---|---|
| `startTask(orderId)` | `{orderId}` | `orders.status = 'in_progress'` | No |
| `submitDeliverable(input)` | `{orderId, kind, fileUrl?, linkUrl?, note}` | `deliverables`, `orders.status = 'internal_review'` | No |
| `uploadDeliverable(formData)` | multipart form | Supabase Storage → `deliverables.url` | No |
| `reviewDeliverable(id, decision)` | `{deliverableId, decision: z.enum(['approve','request_changes']), reviewNote?}` | `deliverables.status`, `deliverables.reviewed_at`, `orders.status`, `audit_events` | No |

### 3.3 Finance & Pay (★ = transaction required)

| Action | Zod input sketch | Tables written | Tx? |
|---|---|---|---|
| `setPayOverride(staffId, override)` | `{staffId, base: z.number().min(0), rate: z.number().min(0).max(100), bonus: z.number().min(0), gigRates?: Record<string,number>, gigPkgRates?: Record<string,number>}` | `pay_overrides` (upsert) | No |
| `deletePayOverride(staffId)` | `{staffId}` | `pay_overrides` (delete) | No |
| `savePayPreset(preset)` | `{name, base, rate, bonus, gigRates, gigPkgRates?}` | `pay_presets` (insert) | No |
| `deletePayPreset(id)` | `{id}` | `pay_presets` (delete) | No |
| `requestStaffPayout(input)` ★ | `{amount: z.number().positive(), methodId}` | `staff_payout_requests`, `audit_events`; verify `amount <= availableToWithdraw` inside tx | Yes |
| `markPayoutPaid(id)` ★ | `{payoutRequestId}` | `staff_payout_requests.status = 'paid'`, `audit_events` | Yes |
| `adjustCustomerCredit(customerId, delta)` ★ | `{customerId, delta: z.number(), reason}` | `customers.balance`, `transactions` (adjustment row), `audit_events` | Yes |
| `runPayrollForPeriod(month)` ★ | `{month: z.string().regex(/^\d{4}-\d{2}$/)}` | `payroll_records` (upsert per staffer), `payroll_gig_counts` | Yes |
| `disputePenalty(id, note)` | `{penaltyId, disputeNote: z.string().max(500)}` | `staff_penalties.status = 'disputed'`, `staff_penalties.dispute_note` | No |

### 3.4 Affiliate

| Action | Zod input sketch | Tables written | Tx? |
|---|---|---|---|
| `applyAsAffiliate(input)` | `{name, handle, email, platform, niche, referralCode?}` | `affiliates`, `users` (role=affiliate) | No |
| `approveAffiliate(id)` | `{affiliateId}` | `affiliates.status = 'active'`, `audit_events` | No |
| `suspendAffiliate(id)` | `{affiliateId}` | `affiliates.status = 'suspended'` | No |
| `requestAffiliatePayout(input)` ★ | `{amount: z.number().positive(), method: z.string()}` | `affiliate_payout_requests`, verify balance | Yes |
| `markAffiliatePayoutPaid(id)` ★ | `{payoutId}` | `affiliate_payout_requests.status = 'paid'`, `affiliates.claimed += amount` | Yes |
| `updateProgramRules(rules)` | `{approvalMode, attribution, cookieWindowDays, holdDays, minPayout, selfReferralBlock, recurring}` | `program_rules` (singleton upsert) | No |
| `updateTierLadder(tiers)` | `AffiliateTierConfig[]` | `affiliate_tier_configs` (upsert) | No |

### 3.5 Messaging & Content

| Action | Zod input sketch | Tables written | Tx? |
|---|---|---|---|
| `sendBroadcast(input)` | `{title, body, article?, kind, banner, pinned, audiences[], ctaLabel?, ctaHref?, publishAt?, expiresAt?, requireAck}` | `broadcasts`, `broadcast_audiences` | No |
| `editBroadcast(id, patch)` | Partial of above | `broadcasts`, `broadcast_audiences` | No |
| `recallBroadcast(id)` | `{broadcastId}` | `broadcasts.active = false` | No |
| `markBroadcastRead(id)` | `{broadcastId}` | `broadcast_receipts` (upsert `read=true`) | No |
| `ackBroadcast(id)` | `{broadcastId}` | `broadcast_receipts.acked = true` | No |
| `publishDoc(input)` | `{title, format, summary, tags, body?, html?, audiences[], resources[], pinned}` | `docs`, `doc_audiences`, `doc_resources` | No |
| `updateDoc(id, patch)` | Partial of above | `docs`, `doc_audiences`, `doc_resources` | No |
| `deleteDoc(id)` | `{docId}` — blocked if `system=true` | `docs.active = false` (soft delete) | No |
| `createNote(input)` | `{title, body, category, labels[], color, pinned}` | `notes` | No |
| `updateNote(id, patch)` | Partial of above | `notes`, `note_attachments` | No |
| `deleteNote(id)` | `{noteId}` | `notes` (hard delete — user owns it) | No |

### 3.6 Tickets

| Action | Zod input sketch | Tables written | Tx? |
|---|---|---|---|
| `raiseTicket(input)` | `{subject, type, channel, priority, orderId?}` | `tickets` | No |
| `replyToTicket(id, text)` | `{ticketId, text: z.string().min(1).max(5000)}` | `ticket_messages` | No |
| `resolveTicket(id)` | `{ticketId}` | `tickets.status = 'resolved'` | No |
| `assignTicket(id, staffId)` | `{ticketId, staffId}` | `tickets.assignee_id` | No |

### 3.7 Staff Settings

| Action | Zod input sketch | Tables written | Tx? |
|---|---|---|---|
| `updateAvailability(input)` | `{status: AvailStatus, handoffPolicy: HandoffPolicy}` | `staff_availability` (upsert) | No |
| `updateWorkHours(hours)` | `WorkHours[]` (7 rows) | `staff_work_hours` (upsert per day) | No |
| `requestLeave(input)` | `{from: z.string().date(), to: z.string().date(), days: z.number().int().positive(), reason}` | `leave_requests` | No |
| `decideLeave(id, decision)` | `{leaveId, decision: z.enum(['approved','declined'])}` | `leave_requests.status`, `leave_requests.decided_at` | No |
| `addPayoutMethod(input)` | `{kind: PayoutMethodKind, label, isDefault, feePct, etaDays}` | `staff_payout_methods` | No |

---

## 4. Where This Code Lives

```
apps/app/src/
├── lib/
│   ├── supabase/
│   │   ├── server.ts          # createServerClient() for RSC + Server Actions
│   │   └── middleware.ts      # session refresh in Next.js middleware
│   ├── errors.ts              # DataAccessError class
│   └── ... (pure functions, unchanged)
├── server/
│   ├── queries/               # Read-only query modules (import 'server-only')
│   │   ├── orders.ts          # buildOrderDetailProps, etc.
│   │   ├── staff.ts           # currentStaffId, buildStaffInsight, etc.
│   │   ├── finance.ts         # staffPaySeed, buildPayrollPeriods, etc.
│   │   ├── affiliate.ts       # portalDataFor, etc.
│   │   ├── manager.ts         # managerScope, buildManagerPerf, etc.
│   │   ├── docs.ts            # docsForStaff/Manager/Customer
│   │   ├── broadcasts.ts      # broadcastsForAudience, unreadCount
│   │   └── customers.ts       # customerSignals
│   └── actions/               # Server Actions (mutations)
│       ├── orders.ts          # placeOrder, transitionOrderStatus, assignOrder
│       ├── deliverables.ts    # submitDeliverable, reviewDeliverable
│       ├── finance.ts         # setPayOverride, requestStaffPayout, etc.
│       ├── affiliate.ts       # requestAffiliatePayout, etc.
│       ├── broadcasts.ts      # sendBroadcast, recallBroadcast, etc.
│       ├── docs.ts            # publishDoc, updateDoc
│       ├── notes.ts           # createNote, updateNote
│       └── tickets.ts         # raiseTicket, replyToTicket
├── data/                      # Phase-0 mock data — kept until domain is cut over
│   ├── adminMock.ts           # ORDERS, STAFF, CUSTOMERS, etc.
│   ├── staffMock.ts           # per-staffer helpers
│   └── ...
└── app/                       # Next.js pages/layouts (no direct DB calls here)
```

**Key rules:**
- Server Components call `server/queries/*` directly (no API layer needed — Next.js RSC
  runs server-side).
- Client Components call Server Actions via `import { action } from '@/server/actions/*'`
  (Next.js bundles them as RPC endpoints automatically).
- The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is **only** used in Supabase CLI
  migration scripts and the seed script — never in application code. Application code uses
  the anon/user JWT and relies on RLS.
- After every mutation that changes page data, call `revalidatePath('/the/page')` (or
  `revalidateTag('orders')`) inside the Server Action so RSC caches are invalidated.

```typescript
// Pattern for a Server Action:
'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const Input = z.object({ orderId: z.string(), status: z.enum([...]) });

export async function transitionOrderStatus(raw: unknown) {
  const { orderId, status } = Input.parse(raw);
  const supabase = await createClient();
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);
  if (error) throw new DataAccessError('orders.transition', error);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
}
```

---

## 5. Cutover Status Checklist

One row per builder/action. Update `Done` to `✓` when the domain ships from DB.

### Read builders

| Builder | Domain | Phase | Done |
|---|---|---|---|
| `buildOrderDetailProps(id)` | Orders | B4 | Pending |
| `packagePrice(service, pkg)` | Catalog | B4 | Pending |
| `servicePriceRange(service)` | Catalog | B4 | Pending |
| `gigRateOf(service, pkg?, …)` | Finance/Catalog | B6 | Pending |
| `currentStaffId()` | Auth | B5 | Pending |
| `currentStaffIdentity()` | Auth | B5 | Pending |
| `currentAffiliateId()` | Auth | B7 | Pending |
| `isImpersonatingAffiliate()` | Auth | B7 | Pending |
| `managerScope(managerId)` | Manager | B5 | Pending |
| `ordersForPod(scope)` | Manager | B5 | Pending |
| `customersForPod(scope)` | Manager | B5 | Pending |
| `ticketsForPod(scope)` | Manager | B9 | Pending |
| `triageForPod(scope)` | Manager | B5 | Pending |
| `qaHealth(scope)` | Manager | B5 | Pending |
| `slaHealth(scope)` | Manager | B9 | Pending |
| `weekDeadlines(scope)` | Manager | B5 | Pending |
| `rosterWithRebalance(scope)` | Manager | B5 | Pending |
| `recentActivity(scope, limit?)` | Manager | B5 | Pending |
| `overdueCount(scope)` | Manager | B5 | Pending |
| `serviceMix(scope)` | Manager | B5 | Pending |
| `buildManagerPerf(managerId)` | Manager | B5 | Pending |
| `allManagerPerf()` | Manager | B5 | Pending |
| `companyBenchmark(perfs?)` | Manager | B5 | Pending |
| `buildStaffInsight(staffId)` | Staff | B5/B6 | Pending |
| `rosterSignals(staffId)` | Staff | B5 | Pending |
| `resolveStaffId(idOrName)` | Staff | B5 | Pending |
| `staffPaySeed(staffId)` *(new feeder)* | Finance | B6 | Pending |
| `buildPayrollPeriods(gran)` | Finance | B6 | Pending |
| `currentPenalties(staffId, month?)` | Finance | B6 | Pending |
| `portalDataFor(id)` | Affiliate | B7 | Pending |
| `docsForStaff(docs, skills)` | Docs | B8 | Pending |
| `docsForManager(docs)` | Docs | B8 | Pending |
| `docsForCustomer(docs)` | Docs | B8 | Pending |
| `docForStaff(docs, id, skills)` | Docs | B8 | Pending |
| `docForManager(docs, id)` | Docs | B8 | Pending |
| `docForCustomer(docs, id)` | Docs | B8 | Pending |
| `broadcastsForAudience(audience)` *(new)* | Broadcasts | B8 | Pending |
| `unreadCount(userId, audience)` *(new)* | Broadcasts | B8 | Pending |
| `customerSignals(idOrName)` | Customers | B4 | Pending |
| `resolveCustomerId(idOrName)` | Customers | B4 | Pending |

### Write actions (Server Actions)

| Action | Domain | Phase | Tx? | Done |
|---|---|---|---|---|
| `placeOrder` | Orders | B4 | No | Pending |
| `transitionOrderStatus` | Orders | B4 | No | Pending |
| `assignOrder` | Orders | B4 | No | Pending |
| `setOrderPriority` | Orders | B4 | No | Pending |
| `cancelOrder` | Orders | B4 | No | Pending |
| `startTask` | Staff work | B5 | No | Pending |
| `submitDeliverable` | Staff work | B5 | No | Pending |
| `uploadDeliverable` | Staff work | B5 | No | Pending |
| `reviewDeliverable` | Staff work | B5 | No | Pending |
| `setPayOverride` | Finance | B6 | No | Pending |
| `deletePayOverride` | Finance | B6 | No | Pending |
| `savePayPreset` | Finance | B6 | No | Pending |
| `deletePayPreset` | Finance | B6 | No | Pending |
| `requestStaffPayout` ★ | Finance | B6 | Yes | Pending |
| `markPayoutPaid` ★ | Finance | B6 | Yes | Pending |
| `adjustCustomerCredit` ★ | Finance | B6 | Yes | Pending |
| `runPayrollForPeriod` ★ | Finance | B6 | Yes | Pending |
| `disputePenalty` | Finance | B6 | No | Pending |
| `applyAsAffiliate` | Affiliate | B7 | No | Pending |
| `approveAffiliate` | Affiliate | B7 | No | Pending |
| `suspendAffiliate` | Affiliate | B7 | No | Pending |
| `requestAffiliatePayout` ★ | Affiliate | B7 | Yes | Pending |
| `markAffiliatePayoutPaid` ★ | Affiliate | B7 | Yes | Pending |
| `updateProgramRules` | Affiliate | B7 | No | Pending |
| `updateTierLadder` | Affiliate | B7 | No | Pending |
| `sendBroadcast` | Messaging | B8 | No | Pending |
| `editBroadcast` | Messaging | B8 | No | Pending |
| `recallBroadcast` | Messaging | B8 | No | Pending |
| `markBroadcastRead` | Messaging | B8 | No | Pending |
| `ackBroadcast` | Messaging | B8 | No | Pending |
| `publishDoc` | Docs | B8 | No | Pending |
| `updateDoc` | Docs | B8 | No | Pending |
| `deleteDoc` | Docs | B8 | No | Pending |
| `createNote` | Notes | B8 | No | Pending |
| `updateNote` | Notes | B8 | No | Pending |
| `deleteNote` | Notes | B8 | No | Pending |
| `raiseTicket` | Tickets | B9 | No | Pending |
| `replyToTicket` | Tickets | B9 | No | Pending |
| `resolveTicket` | Tickets | B9 | No | Pending |
| `assignTicket` | Tickets | B9 | No | Pending |
| `updateAvailability` | Staff settings | B5 | No | Pending |
| `updateWorkHours` | Staff settings | B5 | No | Pending |
| `requestLeave` | Staff settings | B5 | No | Pending |
| `decideLeave` | Staff settings | B5 | No | Pending |
| `addPayoutMethod` | Finance | B6 | No | Pending |

---

## 6. Hard Cases — Return Shapes Difficult to Reproduce from SQL

The following builders have return shapes that will require extra care because they mix
computed math, multi-source aggregation, or synthetic fields:

1. **`buildStaffInsight(staffId)` → `StaffInsight`** — 30-field DTO spanning 8
   concerns. Recommend a Postgres RPC (`build_staff_insight`) that returns all raw rows
   in a single CTE-based query; the TypeScript layer then applies pure scoring math. The
   `activity: Record<Granularity, ActivityBucket[]>` field (four granularities, each a
   series of `{label, tasks, pay}` points) is the most SQL-heavy part.

2. **`buildManagerPerf(managerId)` → `ManagerPerf`** — The `growthSlope` signal
   currently reads from `staff.trend[]` (a mock-authored synthetic array). The DB
   replacement must compute slope from real deliverable counts grouped by month; this
   requires a window function or a pre-computed `staff_trend_cache` table updated by a
   trigger.

3. **`buildPayrollPeriods(gran)` → `PayPeriod[]`** — The period grouping (month vs.
   quarter) is currently done in TypeScript over in-memory data. The DB version should
   push the `date_trunc`-based grouping into SQL and return pre-aggregated
   `(period_key, staff_id, sum_base, sum_gig, sum_commission, sum_bonus, sum_tasks)`
   rows, avoiding N×M row explosion.

4. **`docsForStaff(docs, skills)` — multi-audience join** — The `audiences?: DocAudience[]`
   field on `StaffDoc` means a doc can match on any of several audiences. The join on
   `doc_audiences` is straightforward but requires `DISTINCT ON (d.id)` to avoid
   returning the same doc multiple times when it matches several of the viewer's skills.

5. **`portalDataFor(id)` for non-default affiliates** — Currently synthesizes referral
   and commission rows from aggregate totals. The DB replaces synthesis with real rows;
   there are no structural problems, but the `CommissionEvent.order_code` field may
   reference orders outside the `orders` table (external referred orders — see
   `DATA-MODEL.md §5` unresolved gap). The `commission_events.order_id` FK must be
   nullable to handle this.
