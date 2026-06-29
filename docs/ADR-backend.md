# ADR-backend.md — Kiến trúc backend HevaSEO (bản tinh gọn)

> **Ngày:** 2026-06-28 · **Trạng thái:** Đề xuất, chờ chốt
> **Quan hệ với v3:** Bản này **siết scope** của `docs/superpowers/specs/2026-06-14-hevaseo-architecture-plan.md` (v3).
> Giữ mọi quyết định "rẻ-bây-giờ / đau-retrofit"; cắt/hoãn mọi quyết định "đắt-bây-giờ / cho-tương-lai-mơ-hồ".
> Mục §7 ghi rõ **khác v3 ở đâu và vì sao** — không xoá lịch sử, chỉ chỉnh hướng.

---

## 0. Nguyên tắc đánh giá

Sản phẩm đang ở **Phase 0**: UI mock đầy đủ (89 route, 5 portal), backend = 0 dòng, ~0 user, **1 thương hiệu**, đội nhỏ. Mọi quyết định kiến trúc chấm theo một câu hỏi:

> *"Thứ này đắt để thêm sau, hay rẻ để thêm sau?"*

- **Đắt-sau (đau retrofit)** → làm ngay, kể cả khi chưa cần: `tenant_id`, mô hình tiền, RLS.
- **Rẻ-sau (đảo ngược được)** → hoãn tới khi có áp lực thật: self-host, scale-out, forkable core.

Mục tiêu Phase 0–1 không phải "sẵn sàng 100k user" — mà là **một đơn hàng thật chạy hết vòng end-to-end** trên hạ tầng thật.

---

## 1. Quyết định chốt (tóm tắt)

### ✅ GIỮ — đắt để retrofit, độ tin cao

| # | Quyết định | Lý do |
|---|---|---|
| K1 | **Postgres** (quan hệ + JSONB lai) | ~50 FK + nghiệp vụ tiền + RLS → SQL bắt buộc. JSONB lo phần document (`audit.meta`, `docs.body`, `tags`). |
| K2 | **DB function `SECURITY DEFINER`** cho tiền & đổi trạng thái | `create_order` (atomic debit `UPDATE…WHERE balance>=price`), `advance_order` (validate qua `allowed_transitions`), `cancel_order`, `topup`. Atomic + audit trong DB, app không UPDATE thẳng `balance`/`status`. **Cancel policy (D1, refine 2026-06-29):** chỉ huỷ khi đơn còn "planned" (`new\|confirmed\|assigned`, staff chưa nhận); vào `in_progress` trở đi → `NOT_CANCELABLE`. Huỷ **hoàn 95% về dashboard credit** (không refund thẻ — gồm khách quick-buy) và **giữ phí 5%** (`cancel_fee`, chống spam). Refund+fee giữ `balance==SUM(ledger)`. |
| K3 | **Balance authoritative O(1)** + `credit_ledger` append-only | `UPDATE … WHERE balance >= price` = khoá hàng + kiểm tra trong một câu. Ledger = sổ audit. Job đối soát định kỳ. |
| K4 | **RLS là mô hình bảo mật** | Query qua JWT user (`@supabase/ssr`) → RLS enforce. Không filter thủ công ở app. |
| K5 | **`tenant_id` trên mọi bảng từ ngày 1** | Rẻ giờ, đau kinh khủng nếu retrofit. 1 brand = 1 tenant hằng; vẫn lợi cho tách demo/staging. **Canh bạc "tương lai" duy nhất được giữ.** |
| K6 | **TypeScript một codebase** — Next.js route handlers + Server Actions | Không NestJS/Express/GraphQL/tRPC ở v1. Đủ và gọn. |
| K7 | **Supabase Auth + Storage** | Không tự code auth (ổ bug bảo mật). |
| K8 | **Zod** ở biên · **pgTAP** test DB · **vitest** (đã có) | Validate at boundaries; test-first cho schema/RLS/function. |
| K9 | **Money-stripped VIEWS cho role money-blind** (eng-review F1) | Manager money-blind là **column**-level, RLS chỉ làm **row**-level. Manager đọc orders/customers/staff qua VIEW bỏ cột tiền (`value`, `cost`, `ltv`, `pay`); RLS+tenant gắn trên view. Một view tái dùng cho mọi màn manager → fix luôn gap #7 (tiền leak vào RSC payload). View là column-projection thuần (không JOIN/GROUP BY) để planner đẩy predicate xuống index. |
| K10 | **Impersonation = act-as claim, audit nguyên gốc** (eng-review F3) | JWT mang `real_user_id` (admin) + `acting_as_id`. RLS dùng `acting_as` cho visibility; `audit_log` **luôn** ghi `real_user_id`. View-mode (manager xem staff) thêm cờ `read_only` → DB function từ chối mutation. Không bao giờ cấp JWT gốc của target. Claim bơm qua **Supabase custom-access-token Auth hook** (PoC Phase 0 — xem §5). |
| K11 | **Một khuôn mẫu ledger, 3 instance** (eng-review F2) | 3 hệ tiền độc lập: `customer_credit`, `staff_wallet`, `affiliate_commission`. Mỗi cái bảng ledger riêng (append-only) + balance authoritative O(1) + payout flow — cùng khuôn K3, cùng độ atomic. Giữ rbac.ts capabilities (`finance.view`…) làm cổng cột. **Cập nhật 2026-06-29:** `staff_wallet` là ví của **mọi worker nội bộ** — cả manager (own-row RLS, `manager_wallet.sql`). Lương manager = base + override (gigPct%·podGig + commPct%·podCommission), posts vào wallet_ledger kind=`commission`; manager KHÔNG có KPI bonus. |

### ✂️ CẮT / HOÃN — đắt giờ, cho tương lai mơ hồ

| # | v3 định làm | Bản này | Lý do |
|---|---|---|---|
| C1 | Self-host **toàn bộ** Supabase từ đầu (D3) | **Managed Supabase trước**, self-host khi cần | Đảo ngược được — cùng Postgres/migrations/API. Xoá cả checklist ops §8 cho 0 user. |
| C2 | `packages/core` forkable từ Phase 0 (D10) | **Hoãn tới Phase 4** | Không thể thiết kế abstraction tái dùng tốt trước khi có 1 bản chạy được. Build hevaseo cụ thể trước. |
| C3 | Workflow-as-data `workflow_states`/`allowed_transitions` (D15) | **Postgres enum + `allowed_transitions` đơn giản** | Chỉ được biện minh bởi tính fork (C2). Giữ type-safety thay vì đổi lấy fork giả định. |
| C4 | RBAC **fork-indirection** CLIENT/OPERATOR/EXECUTOR (D16) | **Giữ rbac.ts capabilities**, chỉ bỏ tầng abstraction để fork | Sửa sau eng-review F5: capabilities (`finance.view`, `pricing.view`…) ánh xạ thẳng sang RLS predicate + money-stripped view (K9) → **giữ**. Chỉ bỏ CLIENT/OPERATOR/EXECUTOR (chỉ phục vụ fork). Role cụ thể → capabilities → RLS. |
| C5 | Read replica + partition + pooler **vận hành** từ Phase 0 (D12/D17/D19) | **Chỉ "schema-ready"**, không bật | Thiết kế sẵn (cột `created_at`, index) rẻ. Vận hành ở 0 user là đốt công. |
| C6 | BullMQ/Redis + Realtime từ sớm | **Hoãn** tới khi có nhu cầu thật (deadline reminder, Stripe reconcile) | Phase 1 chưa cần job nền hay socket. |

### ⚠️ DÈ CHỪNG — rủi ro gần, ít ai ưu tiên

| # | Rủi ro | Đối sách |
|---|---|---|
| W1 | **Tầng đọc mock→thật bị viết lại** | 89 route đọc mock **đồng bộ**; query thật **async + scope role/tenant + phân trang + shape theo vai**. Seam "swap import là xong" là lạc quan quá (v3 §9 tự nhận). Đây là chi phí lớn nhất Phase 1 — đổ công vào đây, không phải replica. |
| W2 | Quick checkout chống takeover + **email lifecycle** | Match-by-email chỉ link shadow account (`claimed_at IS NULL`); webhook idempotent qua `stripe_event_id UNIQUE`. Giữ 6 chốt v3 §7 khi tới Phase 2. **Refine chốt 4 (2026-06-29):** thay "magic-link-only" → **temp-password** (email mật khẩu tạm + bắt buộc đổi lần đầu) để khớp pattern `createAccount` đang có + ý product. **Email giao dịch:** `email_templates`+`email_log` (idempotent theo `order_id`+`event`), DB fn `send_order_email(order,event)` tự gửi ở: checkout / order.accepted / order.completed(+report). Khách có thể chỉ nhận report qua email. Xem FEATURES §2.16, CONTRACTS §A. |

---

## 2. Tech stack chốt

```
┌─ Next.js 15 (App Router) — apps/app          ← đã có, không thêm framework backend
│   • reads:  supabase-js (JWT user) → RLS tự enforce
│   • writes nhạy cảm: gọi DB function (create_order, advance_order…)
│   • API public (checkout): route handler + Zod + Turnstile
│
├─ Supabase MANAGED                              ← C1: managed trước, self-host sau
│   • Postgres 15: bảng lõi, mọi bảng có tenant_id (K5)
│   • Auth: magic link + JWT (K7)
│   • Storage: deliverable, policy scope tenant+customer (K7)
│   • (Realtime/Edge: hoãn — C6)
│
├─ Tooling
│   • Supabase CLI — migrations (supabase/migrations/*.sql)
│   • pgTAP — test schema/RLS/function (supabase/tests/*)
│   • Zod — validate biên · vitest — unit (đã có)
│   • supabase gen types typescript — type DB cho read (KHÔNG ORM ở v1)
│
└─ HOÃN tới khi cần
    BullMQ + Redis · Realtime · read replica · partition vận hành
    · packages/core (fork) · Drizzle/ORM · Stripe (Phase 2)
```

**ORM:** không, ở v1. `supabase-js` + types sinh tự động cho read; mutation nhạy cảm qua DB function. Một nguồn sự thật schema = migrations SQL. Cân nhắc Drizzle **sau** nếu read analytics rườm rà.

---

## 3. Data model

Chi tiết field/enum/FK: **[docs/DATA-MODEL.md](DATA-MODEL.md)** (suy ra từ mock, chính xác từng kiểu).

Bảng lõi Phase 0–1 (rút gọn, mọi bảng có `tenant_id`):

```
tenants
  └─ profiles (role: admin|manager|staff|customer|affiliate)   ← C4 role cụ thể
       └─ customers (status: shadow|claimed, tier, balance)
            ├─ customer_balances (1:1, balance authoritative O(1))   ← K3
            ├─ credit_ledger (append-only, schema-ready partition)   ← K3/C5
            └─ orders (state: enum order_state)                      ← C3 enum
                 ├─ allowed_transitions (from_state, to_state, by_role)  ← C3 đơn giản
                 ├─ tasks (assignee_id → staff, deadline, priority)
                 └─ deliverables (version, review_status)
       tickets · invoices · projects · messages (visibility: internal|customer)
       notifications (user_id, schema-ready partition)
       audit_log (append-only, meta jsonb, schema-ready partition)

  staff (profile) ─ staff_wallet (1:1 balance O(1)) + wallet_ledger (append-only)   ← K11
                  ├─ payroll: base/gig/commission/bonus − penalties; pay_overrides; pay_presets
                  └─ payout_requests (requested→approved→paid)
  affiliates ─ affiliate_commission (1:1 balance O(1)) + commission_ledger          ← K11
             ├─ referrals (customer_id, volume, status) → tier
             └─ affiliate_payouts
  docs (audiences[] , required_skills[])  ← array-RLS: audiences @> role AND          ← F4 (Phase 2)
                                              required_skills && staff.skills
  broadcasts (audiences[]) ─ broadcast_events (append-only: sent/read/click)          ← F4 (Phase 2)
                              → analytics aggregation (read timeline, hour heatmap)
```

> **Money-stripped views (K9):** `orders_mgr`, `customers_mgr`, `staff_mgr` = column-projection của bảng gốc bỏ cột tiền, RLS pod-scope + tenant gắn trên view. Manager surfaces đọc qua view, không bao giờ chạm bảng gốc.

**Lai quan hệ + document:** dùng JSONB đúng chỗ cần linh hoạt (`audit_log.meta`, `docs.body` = `DocBlock[]`, `tags text[]`), phần còn lại quan hệ chuẩn với FK.

---

## 4. Bảo mật (không thoả hiệp)

- **RLS = nguồn sự thật.** Mọi truy vấn theo ngữ cảnh user đi qua client mang JWT user → RLS enforce, **luôn kèm `tenant_id`**. Cross-tenant = vô hình tuyệt đối.
- **Ma trận "ai thấy gì"** (giữ từ v3 §5): staff **ẩn hoàn toàn** giá / `credit_ledger` / `balance`; customer chỉ thấy của mình; admin full.
- **`service_role` chỉ 3 nơi** không có user context: Stripe webhook, worker, migration/seed. Lint chặn import ngoài 3 nơi (D18 — giữ).
- **Logic nhạy cảm trong DB function `SECURITY DEFINER`** (K2). App không UPDATE thẳng `status`/`balance`.
- **Test RLS theo role + tenant** (pgTAP): "role X / tenant A đọc dữ liệu role Y / tenant B → 0 dòng" là điều kiện done của mỗi slice.
- **Mọi cột trong predicate RLS phải có index** (`tenant_id`, `customer_id`, `assignee_id`, `order_id`, `state`) — composite `(tenant_id, <khoá>)`.
- **Money-blind = column-level (K9, eng-review F1):** RLS là row-level → không giấu được cột `value` khi manager thấy hàng. Dùng **money-stripped views** (`orders_mgr`…) cho mọi role money-blind; cấm manager surface đọc bảng gốc. Test pgTAP: manager đọc view → cột tiền vắng mặt/NULL.
- **Impersonation (K10, eng-review F3):** RLS đọc `acting_as_id` từ JWT (bơm qua Auth hook); `audit_log` ghi `real_user_id`; view-mode `read_only` → DB function chặn mutation. Test pgTAP: admin act-as-customer → audit ghi admin; manager view-as-staff → mutation bị từ chối.
- **Docs gating (F4):** array-containment RLS — `audiences @> ARRAY[role]` và (với staff) `required_skills && staff.skills`.

---

## 5. Lộ trình phase (tinh gọn)

| Phase | Nội dung | Điều kiện "done" |
|---|---|---|
| **0a — Nền test** *(đã có plan)* | Supabase CLI + migration pipeline + pgTAP loop `pnpm verify:db` | `pnpm db:start && pnpm verify:db` xanh trên DB mới migrate. |
| **0a+ — PoC bảo mật** *(mới, eng-review)* | **Verify trên managed Supabase:** (1) custom-access-token Auth hook bơm được `acting_as_id`/`read_only` (K10); (2) RLS đọc được custom claim; (3) RLS-on-view giữ index (K9). | Hook bơm claim OK; RLS-on-view trả đúng + dùng index. Nếu fail → cân lại C1 (self-host). |
| **0b — Schema lõi** | Bảng lõi §3 **có `tenant_id`** + enum `order_state` + `allowed_transitions` + `customer_balances`. Index RLS. Partition **schema-ready** (chưa bật). | Migration apply sạch; pgTAP cấu trúc xanh. |
| **0c — RLS + role** | RLS theo role cụ thể + `tenant_id` mọi bảng; ma trận §4. | Test RLS theo role+tenant xanh (cross-tenant = 0 dòng). |
| **0d — DB functions** | `create_order` (balance O(1)), `advance_order` (tra `allowed_transitions`), `cancel_order` (refund D1), `topup`. | pgTAP: atomic, idempotent, audit ghi đúng; race insufficient-credit chặn đúng. |
| **1 — Vertical slice Orders** | Auth (magic link) + đọc qua JWT-scoped client + **viết lại 1 tầng đọc mock→thật** (orders) + 1 vòng đơn end-to-end (tạo → gán → đổi trạng thái → deliverable). **+ money-stripped views (K9)** vì manager order surface chạm dữ liệu thật ngay. **+ customer_credit ledger (K11)**. | UI orders chạy trên DB thật; build xanh; W1 giải cho slice này; 7 test CRITICAL xanh. |
| **2 — Tiền & nghiệm thu + nội dung** | Credit ledger UI, **quick checkout (6 chốt v3 §7)** + Stripe, Approve/Request changes, messaging 2 tầng (polling). **+ staff_wallet ledger + payroll (K11). + Docs array-RLS + Broadcasts event log (F4).** | Checkout end-to-end; webhook idempotent; reconcile job; docs/broadcast trên DB thật. |
| **3 — Vận hành sâu** | Audit UI, workload staff, SLA, analytics. **+ affiliate_commission ledger + payout (K11). + Impersonation act-as (K10).** **Bật** BullMQ/Redis khi có job thật. | — |
| **4 — Scale & fork (nếu cần)** | **Lúc này mới** cân: trích `packages/core`, read replica, partition vận hành, self-host, white-label tenant thứ 2. | Có tải/nhu cầu thật chứng minh. |

Mỗi slice = `migration + RLS + (DB function) + repository impl + swap 1 file mock + pgTAP/integration test`. Một slice xong là ship + verify độc lập.

---

## 6. Nguyên tắc vận hành (cho agent code tự động)

- **Một slice một lần.** Không mở slice mới khi slice cũ chưa xanh.
- **TDD bắt buộc:** pgTAP/test trước (RED) → migration/impl (GREEN) → refactor.
- **Verify gate cứng:** mỗi task chạy `pnpm verify:db` (+ `pnpm --filter @heva/app build` với slice swap mock) phải pass mới tick.
- **Không phá contract:** kiểu trả về phải khớp shape mock hiện tại (xem [DATA-MODEL.md](DATA-MODEL.md)). Buộc đổi → dừng, báo người.
- **Bảo mật là cổng chặn:** mọi bảng có RLS; test RLS theo role trước khi coi là done.
- **Stop conditions** (dừng hỏi, đừng tự chế): cần đổi contract · cần secret mới · RLS không diễn đạt được rule · phải bật một mục đã hoãn (C1–C6).
- Commit nhỏ theo conventional commits, mỗi slice một nhánh logic.

---

## 7. Khác v3 ở đâu & vì sao (dấu vết quyết định)

| Mã | v3 chốt | Bản này | Lý do đổi |
|---|---|---|---|
| C1 | D3 self-host toàn bộ ngay | Managed trước | Đảo ngược được; cùng Postgres/migrations. Ops self-host vô nghĩa ở 0 user. |
| C2 | D10 forkable core từ Phase 0 | Hoãn Phase 4 | Abstraction tái dùng phải trích *từ* bản chạy được, không vẽ trước. v3 §10 vốn cũng xếp core ở Phase 4 — bản này gỡ luôn ràng buộc "domain-agnostic từ ngày 1" khỏi Phase 0. |
| C3 | D15 workflow-as-data | Enum + transitions đơn giản | Chỉ phục vụ fork (C2). Giữ type-safety thay vì đổi lấy fork giả định. |
| C4 | D16 capability RBAC | Role cụ thể từ `rbac.ts` | Như C3. Gián tiếp hoá khi fork thành thật. |
| C5 | D12/D17/D19 scale-out vận hành sớm | Schema-ready, không bật | Eng-review §13 đã trim một phần; bản này xác nhận & mở rộng. |

**Không đổi với v3:** Postgres, mô hình tiền (ledger + balance O(1)), RLS không bypass, DB function state machine, quick-checkout 6 chốt, `tenant_id` từ ngày 1. Đây là phần lõi đúng đắn của v3 — bản này chỉ cắt phần phục vụ "100k user + fork" mà giai đoạn hiện tại chưa cần.

---

## 8. Tài liệu liên quan

- [DATA-MODEL.md](DATA-MODEL.md) — blueprint field/enum/F/K chính xác từ mock.
- [superpowers/specs/2026-06-14-hevaseo-architecture-plan.md](superpowers/specs/2026-06-14-hevaseo-architecture-plan.md) — v3 đầy đủ (bối cảnh, D1–D19, scale topology cho tương lai).
- [superpowers/plans/2026-06-16-phase0a-db-foundation.md](superpowers/plans/2026-06-16-phase0a-db-foundation.md) — plan 0a (test harness) — vẫn áp dụng.
- [rbac.md](rbac.md) — ma trận RBAC một nguồn (`lib/rbac.ts`).

---

## 9. Eng-review outputs (2026-06-28, /plan-eng-review)

### What already exists (tái dùng, không build lại)
- `lib/rbac.ts` capability matrix → map thẳng sang RLS predicate + cổng cột money-blind (giữ, F5).
- `lib/managerScope.ts` (`ordersForPod`, `auditInPod`…) → logic pod-scope đã có, port sang RLS pod policy.
- `lib/sanitizeHtml.ts` → production-ready, dùng nguyên cho docs/notes/broadcasts.
- `docs/DATA-MODEL.md` → field/enum/FK chính xác cho mọi bảng (gồm payroll, affiliate, broadcast, docs).
- Math libs thuần (`lib/affiliate.ts`, `lib/staff.ts`, `lib/managerPerf.ts`) → đúng, chỉ cần đổi nguồn dữ liệu.

### NOT in scope (cố ý hoãn)
- Self-host, read replica, partition vận hành, `packages/core` fork (C1/C2/C5 — đắt giờ, cho tương lai).
- Realtime live cho messages (polling trước — v3 D14).
- Single-table polymorphic ledger (đã cân nhắc; chọn 3 bảng vì FK sạch + RLS theo domain).

### Failure modes (codepath mới)
| Codepath | Cách hỏng | Test? | Error handling? | User thấy? |
|---|---|---|---|---|
| money-stripped view | manager đọc bảng gốc thay vì view → tiền leak | pgTAP CRITICAL | lint chặn import bảng gốc ở manager surface | (ẩn) |
| act-as claim | audit ghi nhầm acting_as thay vì real_user → mất truy vết | pgTAP CRITICAL | DB function ghi `real_user_id` cứng | — |
| 3 ledgers atomic | balance lệch SUM(ledger) | pgTAP CRITICAL + reconcile job | `UPDATE…WHERE balance>=` guard | INSUFFICIENT_CREDIT |
| Auth hook (managed) | hook không bơm được claim | PoC 0a+ | fallback: cân self-host (C1) | — |

→ Không có critical gap nào vừa silent + vô test + vô error-handling: cả 4 đều có test CRITICAL gắn.

### Parallelization (sau khi 0a/0b/0c/0d xong, tuần tự)
- Lane A: Orders slice + money-stripped views (P1, shared `orders`).
- Lane B: customer_credit ledger (P1, độc lập bảng tiền).
- Lane C (sau A,B): Docs array-RLS + Broadcasts (P2, độc lập order).
- Lane D (sau A): staff_wallet + payroll (P2). Impersonation (P3) phụ thuộc Auth → lane riêng cuối.

## Implementation Tasks
- [ ] **T1 (P1)** — security PoC — Verify custom-access-token Auth hook + RLS-on-view trên managed Supabase (Phase 0a+). Verify: hook bơm `acting_as_id`; RLS-on-view dùng index.
- [ ] **T2 (P1)** — schema — Thêm `staff_wallet`/`wallet_ledger`, `affiliate_commission`/`commission_ledger`, `payout_requests`, `pay_overrides/presets`, `docs(audiences[],required_skills[])`, `broadcasts`/`broadcast_events` vào migrations 0b. Verify: pgTAP cấu trúc xanh.
- [ ] **T3 (P1)** — security — `orders_mgr`/`customers_mgr`/`staff_mgr` money-stripped views + RLS pod-scope. Verify: pgTAP manager-đọc-view không có cột tiền.
- [ ] **T4 (P1)** — db-fn — ledger pattern dùng chung cho 3 hệ tiền (balance O(1) + reconcile). Verify: pgTAP atomic + balance==SUM.
- [ ] **T5 (P3)** — auth — impersonation act-as claim + audit real_user + view-mode read_only. Verify: pgTAP audit ghi admin; mutation view-mode bị chặn.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 5 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CROSS-MODEL:** Outside voice (inline, Codex absent) flagged C1↔security tension → resolved: keep managed + Phase-0 Auth-hook PoC (T1).
- **VERDICT:** ENG CLEARED — ready to implement. 5 findings folded into ADR §1/§3/§4/§5 (K9–K11, C4 fix, F4).

NO UNRESOLVED DECISIONS
