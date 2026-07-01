# CONTRACTS.md — Seam hợp đồng frontend ↔ backend

> **Ngày:** 2026-06-29 · **Trạng thái:** Spec không-được-phá
> **Mục đích:** Ghim **chữ ký + kiểu trả về** mà các route đang gọi từ `apps/app/src/data|lib/*` **và** `apps/web/src/data/*` (marketing).
> Backend phải làm các hàm này trả **dữ liệu thật với ĐÚNG kiểu hiện tại**. Agent dựa vào file này để **không drift**.
> Field/enum chi tiết: [DATA-MODEL.md](DATA-MODEL.md).
>
> **Chống-sót feature:** `pnpm contract-coverage` quét MỌI module data/lib ở cả 2 app và **fail nếu module nào vắng** khỏi file này (module cố ý không-phải-contract nằm trong `EXEMPT` của `scripts/contract-coverage.mjs` kèm lý do). Chạy nó trong CI để CONTRACTS không bao giờ bỏ sót một tầng dữ liệu nào.

---

## 0. Cách đọc

- **[READ]** = hàm đọc dữ liệu → backend thay bằng query (async, RLS-scoped). **Đây là seam W1.**
- **[WRITE]** = hàm ghi → backend thay bằng DB function/route handler.
- **[PURE]** = logic thuần (math, format) → **GIỮ NGUYÊN**, chỉ đổi nguồn dữ liệu đầu vào. Đã có test.
- **[HOOK]** = React hook trên localStorage → backend thay bằng query + mutation server.

**Luật vàng:** kiểu trả về **không đổi**. Cần đổi shape → STOP, hỏi người (stop-condition ADR §6).
Hôm nay phần lớn hàm READ là **đồng bộ**; backend làm chúng **async** → mọi caller phải `await`. Đây chính là W1 (viết lại tầng đọc).

---

## 1. Orders (Lane A — slice đầu)

```ts
// [READ — REAL, Lane A inc-3a/3b] data/orders.server.ts (server-only, RLS-scoped):
getOrders(): Promise<AdminOrder[]>               // admin→all · customer→own · staff/manager→0 (use money-stripped view) — replaces ORDERS
getOrderById(id): Promise<AdminOrder | null>     // RLS-scoped single read for the detail route
getPodOrders(): Promise<AdminOrder[]>            // money-blind: reads orders_mgr view (no value→0); manager→tenant, staff→own
getPodOrderById(id): Promise<AdminOrder | null>  // money-blind single read via orders_mgr (view WHERE = access gate)
getMyOrders(): Promise<Order[]>                   // customer dashboard: own orders DERIVED to data/mock.ts Order (domain/progress/invoice/pay defaulted; canceled excluded)
// buildOrderDetailProps(order|id) now takes a real AdminOrder (mock companions fall back); id form = mock only
// [PURE] lib/orderMap.ts — DB-row→model mappers (toAdminOrder/toMgrOrder/toCustomerOrder + CUST_STATUS/SERVICE_KEY/UUID_RE); unit-tested (orderMap.test.ts). Used by orders.server.ts.
// [READ — REAL, inc-5b/c] data/orders.server.ts → getOrderDetail(id): order_details brief/project/folder/included + order_addons (money-blind) — for /orders/[id]
// [READ — REAL, inc-5e] data/deliverables.server.ts → getDeliverables(): Promise<AdminDeliverable[]>  // review board (admin RLS); staff name via submitter join
// [READ — REAL, inc-analytics] data/analytics.server.ts → getAnalytics(): AnalyticsData  // admin revenue dashboard: KPIs + 90d daily series + service mix + by-source + top customers from real orders (admin RLS). Audience/geo/support panels stay mock (no data source)
// [READ — REAL, Lane A cleanup] data/staffTasks.server.ts → getMyTasks(): StaffTask[]  // signed-in staffer's own assigned orders, money-blind via orders_mgr → board shape; /staff/tasks (+ My Day) with mock fallback for impersonation. Transitions reuse advanceOrderAction (advance_order, claims-derived, ownership-enforced)
// [READ — REAL, inc-E29] data/orderMessages.server.ts → getOrderMessages(orderId): StaffMessage[]  // real order thread; RLS admin all / assigned staff all / customer non-internal only. Post via post_order_message (participant-gated, customer forced non-internal); staff task-detail MessageThread wired
// [HOOK — REAL, inc-5f] lib/useOrderDetail.ts → useOrderDetail(orderId): OrderDetailExtra | undefined  // client lazy fetch of order_details+order_addons (RLS) for slide-over previews
// [HOOK — REAL, inc-E30/E31] lib/useOrderMessages.ts → useOrderMessages(orderId): { comments: OrderComment[]; reload }  // client lazy fetch of order_messages (RLS: customer non-internal / staff+admin+pod-manager all); customer panel + admin/manager order detail threads
// [READ — mock, migrating consumer-by-consumer] data/mock.ts, data/adminMock.ts
ORDERS: AdminOrder[]                              // → SELECT scoped RLS (customer own / manager pod / admin all)
activityFor(o: Order): Activity[]
commentsFor(id: string): OrderComment[]
intakeFor(o: Order): IntakeField[]
deliverablesFor(id: string): Deliverable[]
managerFor(orderId: string): string

// [PURE] lib/orderDetail.ts, lib/myDay.ts — GIỮ
buildOrderDetailProps(id: string)                // tổ hợp props; đổi nguồn → async
nextStaffActions(status: OrderStatus): ...
primaryActionFor(status: OrderStatus): ...
daysToDue(deadline: string | null, today): number

// [WRITE] → DB function (ADR K2)
// create_order, advance_order(to_state), cancel_order  — KHÔNG UPDATE status thẳng
//   cancel_order: chỉ khi "planned" (new|confirmed|assigned, staff chưa nhận) else NOT_CANCELABLE;
//   hoàn 95% về dashboard credit (gồm quick-buy) + giữ phí 5% (cancel_fee). Refund+fee giữ invariant.
```
Kiểu chốt: `AdminOrder`, `Order`, `OrderStatus` (`new|confirmed|assigned|in_progress|internal_review|delivered|changes_requested|approved|completed|canceled`), `Priority`, `Deliverable`.

## 2. Customers & Credit (Lane B — tiền)

```ts
// [READ — REAL, Lane A inc-3f] data/customers.server.ts (server-only, RLS-scoped):
getCustomers(): Promise<AdminCustomer[]>          // admin all · customer own; order count/spend aggregated, balance from customer_balances — replaces CUSTOMERS for /admin/customers
// [READ — mock, manager + customer detail still pending]
CUSTOMERS: AdminCustomer[]                        // RLS: admin all, manager pod (money-stripped view!)
CUSTOMER_EXTRA: Record<string, CustomerExtra>
TRANSACTIONS: CreditTx[]                          // RLS: customer own
// [READ — REAL, Lane B inc-B1 + Phase 2 inc-P2] data/credit.server.ts → getMyCredit(): { balance, transactions: CreditTx[], invoices: Invoice[] }  // customer's own balance + credit_ledger + invoices (RLS, money-blind to staff/manager); wired via portal layout → CreditProvider
// [WRITE — REAL, Phase 2 inc-P2] app/(portal)/credit.actions.ts → topUpAction(amount, label)  // charge via payment provider seam (lib/payments/provider.ts; mock now / Stripe later) → topup fn (service role) + invoice row; client never self-credits
// [WRITE — REAL, Lane B inc-B3] app/(portal)/order.actions.ts → placeOrderAction(input)  // server-priced (computeOrderPrice, real tier) → create_order via service-role client (lib/supabase/service.ts) + order_details/order_addons
// [READ — REAL, Lane D inc-D1..D3] data/staffWallet.server.ts → getMyStaffWallet(): { balance, ledger, methods, payouts } | null  // staffer's own wallet + ledger + payout methods + requests (RLS, money-blind); credited by post_staff_pay, debited by request_payout. null → fall back to mock (demo/impersonation)
// [READ — REAL, Lane D inc-D4] data/adminPayouts.server.ts → getPayoutRequests(): AdminPayoutRequest[]  // admin view of staff withdrawal requests (payout_requests, RLS admin=tenant) for the /admin/finance Payouts tab; resolved via resolvePayoutAction (resolve_payout: approve/pay/reject+refund)
// [READ — REAL, Lane D inc-D5] data/adminPenalties.server.ts → getPenalties(): AdminPenalty[] · getWalletStaff(): WalletStaff[]  // admin penalties list + workers-with-wallets for the apply form; applyPenaltyAction/waivePenaltyAction (apply_penalty debits, waive_penalty refunds); staff dispute via dispute_penalty
// [READ — REAL, Lane D inc-D7] data/adminPayroll.server.ts → getPayrollRuns(): PayrollRun[]  // admin payroll runs (payroll_runs, RLS admin=tenant; worker sees own) for /admin/finance Payouts tab; runPayrollAction (run_payroll: idempotent fixed-pay salary+gig+bonus per worker+period; commission stays in the wallet)
INVOICES: Invoice[] · CUSTOMER_LEDGER: Record<string, LedgerEntry[]>
customerSignals(idOrName): CustomerSignals | null
resolveCustomerId(idOrName): string | null

// [PURE] GIỮ
tierOf(spend: number): Tier                       // new|silver|gold|vip

// [WRITE] → DB function ledger pattern (ADR K11, hệ customer_credit)
// topup, adjust_credit, debit-on-order (atomic balance O(1))
```
Kiểu chốt: `AdminCustomer`, `CreditTx`, `Invoice`, `LedgerEntry`, `Tier`, `Transaction`/`TxKind`/`TxStatus`.

## 3. Staff: tasks · finance · performance (Lane D)

```ts
// [READ — REAL, Lane A inc-3g] data/staff.server.ts (server-only, RLS-scoped):
getStaff(): Promise<AdminStaff[]>                 // admin roster: profiles(role=staff)+staff_details (skills/capacity/role/tz/perf); openLoad from orders in buildStaffVMs. Finance signals still Lane D.
// [READ] data/staffMock.ts, data/adminStaffInsight.ts
STAFF: AdminStaff[]                               // RLS: admin all; staff self; manager pod (money-stripped)
myTasks(staffId): StaffTask[] · myCustomers(staffId): CaredCustomer[]
myFinance(staffId): StaffFinance · myEarnings(staffId): StaffEarnings | null
buildStaffInsight(staffId): StaffInsight | null   // ⚠ finance — admin only
earningsHistory(staffId, months): MonthEarning[]
currentPenalties(staffId, month): CurrentPenalty
deliverableStats(staffId): DeliverableStats

// [PURE] lib/staffFinance.ts, lib/payOverrides.ts, lib/staff.ts — GIỮ (đã có test)
effectivePay(seed, ov?) · gigPay(...) · gigRateOf(service, pkg?, ...)
buildLedger(credits, penalties, payouts) · availableToWithdraw(...)
modelComposite(s) · scoreBreakdown · improvementLever

// [WRITE] → DB function ledger pattern (hệ staff_wallet) + payout flow
// request_payout, approve_payout, apply_penalty

// [READ] data/managerFinance.ts — manager's OWN pay (reuses StaffEarnings/StaffFinance shapes)
managerEarnings(mid): StaffEarnings | null · managerFinance(mid): StaffFinance
managerEarningsHistory(mid): MonthEarning[] · managerEarningsSummary(mid): EarningsSummary
// Manager comp = base + gigPct%·podGig + commPct%·podCommission (derived from MANAGER_PAYOUTS);
// NO KPI bonus. Backend: managers share the worker `staff_wallet` (own-row RLS, manager_wallet.sql);
// override commission posts as a wallet_ledger entry kind='commission'.
// [WRITE]/[PURE] adminMock.ts: ManagerPayout {podGig,podCommission,gigPct,commPct,commission,base};
//   admin Payouts tab effMgrComp(m,ov,podGig,podComm). FinanceClient prop payStyle/showRewards.
```
Kiểu chốt: `AdminStaff`, `StaffTask`, `StaffFinance`, `StaffEarnings`, `StaffWallet`, `StaffPayroll`, `TaskPenalty`, `PayPeriod`, `ManagerPayout`.

## 4. Assignment & Routing (trong Lane A)

```ts
// [READ]
RULES: AdminRule[] · DEFAULT_RULES: ProgramRules  // → assignment-rule table
// [READ — REAL, inc-5d] data/assignmentRules.server.ts → getRules(): Promise<AdminRule[]>  // assignment_rules (admin RLS); priority/active defaulted (not modeled)
SKILL_META · SERVICE_SKILL · STAFF_MANAGER: Record<string,string>
// [PURE] admin/assignment/build.ts — seqMap PHẢI per-request (không module-scope)
// [WRITE] assign_order(order, staff), bulk_assign, rule CRUD (admin only)
```

## 5. Tickets / Support

```ts
// [READ] TICKETS: AdminTicket[]                  // RLS: customer own; manager pod; admin all
//        SLA_LIMIT_H, TICKET_TYPE/CHANNEL meta
// [WRITE] create_ticket, reply, set_status, assign
```
Kiểu chốt: `AdminTicket`, `TicketMessage`, `TicketStatus`, `TicketType`, `TicketChannel`, `SlaTier`.

## 6. Docs & Notes (Lane C — array-RLS)

```ts
// [READ — REAL, Lane C inc-C1/C2/C3] data/docs.server.ts → getDocs(): StaffDoc[]  // the `docs` table, array-RLS-scoped to the viewer's role (admin all; customer/manager by audience; staff by audience+skill-gate) so it does NO client filtering. body jsonb carries rich metadata; top-level audiences[]/required_skills[] drive RLS. Wired into ALL doc surfaces (customer/staff/manager/admin lists + detail pages). C2: JWT skills claim. C3: admin authoring.
// [WRITE — REAL, Lane C inc-C3] app/admin/docs/doc.actions.ts → saveDocAction(SaveDocInput) · deleteDocAction(id)  // admin authoring via upsert_doc/delete_doc DB fns (admin-gated, claims-derived tenant+author; docs table SELECT-only via RLS). HTML sanitized client-side at the composer boundary.
// [PURE] lib/docAudienceMap.ts: composerToDb(composer) → {audiences, requiredSkills} · dbToComposer(audiences, skills) → DocAudience[]  // bridges the composer's role+skill audience model and the DB's audiences[]/required_skills[] split (single source for the round-trip)
// [READ] data/staffDocs.ts — array-containment RLS (mock fallback for un-wired surfaces)
docsForCustomer(docs): StaffDoc[]
docsForStaff(docs, skills): StaffDoc[]            // audiences @> 'staff' AND requiredSkills && skills
docsForManager(docs): StaffDoc[]
canRead(doc, skills): boolean · audiencesOf(doc): DocAudience[]
// [HOOK] data/docsStore.ts, data/notesStore.ts (localStorage → table)
useDocs(): DocsApi · useNotes() · useNote(id)
// [PURE] lib/docBody.ts: blocksToHtml(blocks: DocBlock[])  — GIỮ
```
Kiểu chốt: `StaffDoc`, `DocAudience`, `DocBlock` (jsonb), `SelfNote`, `NoteAttachment`.

## 7. Broadcasts (Lane C — event log)

```ts
// [READ — REAL, Lane C inc-C4] data/broadcasts.server.ts → getMyBroadcasts(): Broadcast[]  // the `broadcasts` table, array-RLS-scoped to the viewer's role audience (recalled/draft filtered). Fetched in each portal layout → BroadcastProvider → store hooks (useInbox/useBanners/useSiteAlerts use it when present, else mock). Read/dismiss/ack state still client-side (real broadcast_events receipts = later).
// [WRITE — REAL, Lane C inc-C5] app/admin/broadcasts/broadcast.actions.ts → saveBroadcastAction · setBroadcastActiveAction · deleteBroadcastAction  // admin compose/recall/delete via upsert_broadcast/set_broadcast_status/delete_broadcast (admin-gated, claims-derived)
// [READ — REAL, Lane C inc-C6] data/broadcastAnalytics.server.ts → getBroadcastAnalytics(id): RecEvent[] (real roster + broadcast_events) · getBroadcastReadCounts(): {read,clicks,total}/broadcast  // feeds the existing pure aggregators (summarize/readTimeline/audienceBreakdown/hourOfDayHistogram) + admin list counts
// [WRITE — REAL, Lane C inc-C6] components/broadcast/receipts.actions.ts → markBroadcastReadAction · markBroadcastClickAction  // recipient read/click → broadcast_events (idempotent); BroadcastProvider holds optimistic readIds
// [HOOK] data/broadcastStore.ts — recipient hooks source from BroadcastProvider real broadcasts + real read-receipts (inc-C4/C6) OR localStorage mock
useBroadcasts() · useInbox(aud) · useBanners(aud) · useSiteAlerts(aud)
markBroadcastClicked(aud, id): void              // mock-log fallback (real click = useInbox().markClicked → broadcast_events)
// [PURE/READ] lib/broadcastAnalytics.ts — GIỮ (đổi nguồn → aggregation query)
messageReadCount(b, now) · hourOfDayHistogram(events) · audienceBreakdown(events)
// [PURE] lib/broadcastAudience.ts, lib/broadcastRoster.ts
```
Kiểu chốt: `Broadcast`, `BroadcastAudience`, `BroadcastKind`, `BroadcastStat`, `BroadcastActivity`.

## 8. Affiliate / KOL (Lane E)

```ts
// [READ — REAL, Lane E inc-E1] data/affiliate.server.ts → getMyAffiliate(): PortalData | null  // signed-in affiliate's own affiliates row + referrals + commission_ledger + balance + payouts (affiliate_*_own RLS) → PortalData; marketing metadata (platform/audience/niche/clicks) defaulted (untabled); null → mock fallback. Wired into /affiliate (dash).
// [READ+WRITE — REAL, Lane E inc-E2/E3] request_affiliate_payout (affiliate self, inc-E2) · data/adminAffiliate.server.ts → getAffiliates(): AdminAffiliate[] · getAffiliatePayouts(): AdminPayout[] (admin RLS, aggregates real tables) · resolveAffiliatePayoutAction(payoutId, approve|pay|reject) → resolve_affiliate_payout (admin-gated, reject refunds balance). AffiliateAdminClient takes realPartners/realPayouts.
// [READ] data/affiliatePortal.ts, data/adminAffiliate.ts (mock fallback + admin views)
portalDataFor(id): PortalData
useAdminAffiliates() · partnerVolumeSeries(a): VolMonth[]
referredServiceMix(affiliateId): ReferredSvc[]
// [PURE] lib/affiliate.ts — GIỮ (đã có test)
commissionFor(orderValue, tier) · nextTierProgress(vol) · tierStateFromRows(rows, vol)
// [WRITE] → ledger pattern (hệ affiliate_commission) + payout
// setPartnerTier, registerAffiliateSelf, createPartner, approve/reject payout
```
Kiểu chốt: `Affiliate`, `AdminAffiliate`, `Payout`/`AdminPayout`, `PortalData`, `TierState`, `EditableTier`.

## 9. RBAC · Auth · Impersonation (xuyên suốt)

```ts
// [PURE] lib/rbac.ts — GIỮ (là cổng cột + map RLS); ADR F5 giữ capabilities
can(role: Role, capability: Capability): boolean
canAccessPath(role, path) · capabilityForPath(path) · homePathFor(role)
// [READ→AUTH] lib/currentStaff.ts, currentAffiliate.ts (async sẵn)
currentStaffId() · currentAffiliateId() · currentStaffIdentity()
// [WRITE→AUTH] lib/impersonation.ts → act-as claim (ADR K10)
impersonate(id, mode) · impersonateCustomer(id) · impersonateAffiliate(id) · clear*()
// [WRITE] lib/* account: createAccount, listAccounts, accountByEmail (mock → Supabase Auth)
```
Kiểu chốt: `Role`, `Capability`, `AuthRole`, `ImpersonateMode` (`act|view`).

## 10. Manager pod scope (money-blind — ADR K9)

```ts
// [PURE] lib/managerScope.ts — logic pod, port sang RLS pod policy + money-stripped view
managerScope(managerId): ManagerScope
ordersForPod(scope) · customersForPod(scope) · ticketsForPod(scope) · auditInPod(scope, e)
// ⚠ MANAGER_PERSONA='mgr1' hằng → thay bằng session manager id
// [PURE] lib/managerPulse.ts, managerPerf.ts — GIỮ (derivation thuần)
```

## 11. Audit · Analytics · Catalog

```ts
// [READ] AUDIT: AuditEntry[]                     // RLS: admin all; manager pod money-stripped
//        REVENUE_*, USER_STATS, TICKET_STATS (admin only) → aggregation query
//        services.ts SERVICE_CATALOG / @heva/catalog (shared) → catalog table
// [WRITE] write_audit (mọi DB function gọi); catalog CRUD (admin)
```

---

## A. Auth · accounts · email lifecycle (xuyên suốt — mới ghi 2026-06-29)

```ts
// [REAL — Lane A inc-2] lib/auth.ts — Supabase Auth wired:
signInWithPassword(email,pw) · signUpCustomer({name,email,password})  // role/tenant forced server-side
useSession() · signOut()                                             // cookie-backed live session
// lib/supabase/server.ts → getServerSession(): Session | null        // RLS-scoped profile role (RSC)
// DB: handle_new_user trigger (shadow-claim | forced-customer) provisions the profile.
// [MOCK — still localStorage, swapped in Lane E] admin provisioning + email lifecycle:
registerUser · registerCustomer · signIn · createAccount(input)    // → temp password + push OutboxMail
genTempPassword · accountByEmail · listAccounts · requestPasswordReset · resetPassword
homePathForRole(role) · useOutbox()                               // OutboxMail[] — the mock email queue
// Kiểu chốt: AuthRole, Account, Session, OutboxMail, CreateAccountInput
// [HOOK] data/staffAccountsStore.ts · data/managerAccountsStore.ts · data/affiliateAdminStore.ts
addCreatedStaff/useCreatedStaff · addCreatedManager/useCreatedManagers
createPartner(input): { account, tempPassword, partner } · registerAffiliateSelf · setPartnerTier
```

**Email lifecycle (FEATURES §2.16 — backend Phase 2):** admin tạo `EmailTemplate {id,name,subject,body,vars}` (đã có trong `AdminSettings.email[]`); hệ thống **tự gửi** theo event đơn:

| Event | Email | Người nhận |
|---|---|---|
| Quick checkout (marketing) thành công | "đơn đã nhận" + **link dashboard + mật khẩu tạm** (đổi ở lần đầu) | khách mới (shadow→claimed) |
| Đơn hoàn thành | "hoàn thành" + **report** (đính kèm/đường dẫn) | khách |
| Đặt đơn qua dashboard | "đơn được tiếp nhận" | khách hiện có |
| Đơn hoàn thành (dashboard) | "hoàn thành" + report | khách hiện có |

Backend: `email_templates`, `email_log` (append-only, idempotent theo `order_id`+`event`), order `report` (jsonb/url). DB function `send_order_email(order_id, event)` render template + enqueue (worker gửi SMTP). Khách có thể **chỉ nhận report qua email**, không cần vào dashboard. → đồng bộ ADR §7 (refine: temp-password thay magic-link-only).

## B. Marketing quick-order (`apps/web` — Astro, điểm vào đặt đơn của khách mới)

```ts
// [READ — REAL, SINGLE SOURCE] @heva/catalog/orders (was apps/web/src/data/orders.ts → now a re-export shim)
orderServices: OrderService[] · getOrderService(slug): OrderService | undefined · DEFAULT_STEPS
priceQuickOrder(service, {packageId, qty, addonPicks}): QuickOrderPrice   // [PURE] server-trusted marketing price (chốt 1); shared by apps/web + the checkout route
// 7 dịch vụ: keyword-research, audit, website-optimization, seo-web-design, backlink, content, indexer
// Mỗi service: packages (flat/bulk/usage pricing) + brief fields + addons. Submit = PAY-FIRST (OrderShell.astro 2 bước).
// Kiểu chốt: OrderService, OrderPackage, PackageGroup, FieldDef, BulkConfig, UsageConfig, UsageTier, PricingMode, OrderStep
// [WRITE→PUBLIC — REAL, Phase 2 inc-Q2] POST /api/public/checkout (apps/app; ADR §7, 6 chốt; mock gateway):
//   validate → priceQuickOrder (server, client total never trusted) → getPaymentProvider().charge (mock/Stripe)
//   → provision/link account (auth.admin.createUser temp-password | existing claimed → attach) 
//   → materialize_order(tenant, customer, code, service, value, actor, ref): ATOMIC topup + order(source=quick) + debit,
//     idempotent by orders.checkout_ref (migration 20260630150000) — service-role-only
//   → optional billing save (customers.billing jsonb). Email send (send_order_email) = Phase 2.
//   chốt status: ①server-price ✅ ②rate-limit in-mem✅ / Turnstile stub ③idempotent✅ ④temp-pass✅ ⑤email-collision✅ ⑥reconcile=Stripe-only
```

## C. Coverage map — module data/lib còn lại (mỗi cái 1 dòng, để `contract-coverage` xanh)

```ts
// [PURE] GIỮ — đổi nguồn dữ liệu đầu vào, không viết lại:
lib/gigPricing.ts        packagePrice(service,pkg) · servicePriceRange(service)      // sell price tham chiếu
lib/orderPricing.ts      computeOrderPrice(catalog, selection): PriceBreakdown        // [REAL, Lane B inc-B2] server-trusted order price (base/usage/bulk−discount+addons−VIP); unit-tested
lib/staffRewards.ts      buildRewards(inputs) · rewardsEarned · rewardsOnOffer        // KPI rewards (staff only)
lib/staffSettings.ts     leaveSummary · workingHoursSummary · DEFAULT_NOTIF_PREFS
lib/availability.ts      availabilityMeta · acceptsWork · AVAILABILITY                // work-status (≠ schedule)
lib/leave.ts             leaveDays · validateLeave · leaveStatusMeta
lib/calendar.ts          monthGrid · monthOf · monthLabel
lib/sanitizeHtml.ts      sanitizeHtml · htmlToText · htmlIsEmpty                      // production-ready, GIỮ
// [READ] đổi sang query:
data/adminPayroll.ts     buildPayrollPeriods(gran): PayPeriod[] · currentPenalties   // period explorer
data/adminCustomerInsight.ts  customerSignals(idOrName) · resolveCustomerId
data/affiliateMock.ts    myAffiliate · myCommissionEvents · myReferrals · myPayouts · marketingAssets
data/affiliatePulse.ts   programStats() · myRank · monthlyChallenge · joinOffer ⚠(module-scope, xem §12)
data/broadcasts.ts       BROADCAST_SEEDS · AUDIENCE_META · KIND_META · isLive/isScheduled/isCritical
data/staffNotes.ts       SEED_NOTES · NOTE_COLORS · mediaEmbedHtml · youtube/vimeo helpers
```

## 12. Cảnh báo singleton (ADR W1 + FEATURES gap #6)

Các module-scope singleton **đóng băng lúc server start** → sai khi impersonate / multi-user. Backend PHẢI keyed theo session:
`CURRENT_STAFF`, `STAFF_NOTIFICATIONS`, `MY_AVAILABILITY`, `MANAGER_PERSONA='mgr1'`, `DEFAULT_AFFILIATE_ID`, và `joinOffer()` (gọi ở module scope trong `affiliate/join/page.tsx`).

## 13. Quy ước cho agent
- Đọc mục domain của slice mình **trước khi code**. Khớp đúng kiểu trả về.
- Hàm **[PURE]** không viết lại — chỉ thay nguồn dữ liệu đầu vào (và `await` nếu nguồn thành async).
- Hàm **[READ]** đồng bộ → async: sửa caller (Server Component) cho đúng, đừng ép vào client.
- Đổi bất kỳ kiểu chốt nào = stop-condition → hỏi người.
