# HevaSEO Platform — Plan kiến trúc kỹ thuật (v3)

> Bản viết lại của `master-plan.md`, kết tinh từ phiên đánh giá kiến trúc 2026-06-14.
> **v3** thêm 2 trục yêu cầu lớn: (A) **lõi tái dùng** để fork sang SaaS khác + white-label;
> (B) **scale self-host ngang** tới 100k users / 10k đồng thời.
> Tài liệu này bổ sung/thay thế phần kỹ thuật của `master-plan.md`.

---

## 0. Quyết định đã chốt

| # | Vấn đề | Quyết định | Hệ quả kỹ thuật |
|---|---|---|---|
| D1 | Trừ credit lúc nào | **Khi đặt đơn** | Cần luồng hoàn credit khi `Canceled`. |
| D2 | Staff ↔ khách | **Staff chat trực tiếp khách** | RLS `messages` phức tạp hơn; vẫn giấu giá/credit khỏi staff. |
| D3 | Hạ tầng Supabase | **Self-host toàn bộ** | Tự ôm stack; kèm checklist ops. |
| D4 | Quick checkout | **Quy hết về credit ledger** | Một sổ sách duy nhất. |
| **D10** | Nhân bản | **Lõi domain-agnostic để fork** + white-label | Tách `packages/core` khỏi product; HevaSEO là reference impl. |
| **D11** | White-label | **`tenant_id` first-class trong core từ ngày 1** | Mọi bảng + RLS scope theo tenant. Đắt nếu retrofit → làm sớm. |
| **D12** | Scale | **Self-host scale ngang, tự vận hành** | Topology đa node: LB + N app + M worker + PG primary/replica + pooler + Realtime cluster. |
| **D13** | Balance ở scale | **Cột balance authoritative, cập nhật nguyên tử; ledger = audit** | Bỏ `SUM(ledger)` mỗi lần check (O(n) → O(1)). |
| **D14** | Realtime ở scale | **Realtime chỉ cho `notifications`; `messages` polling** | 10k websocket live là điểm nghẽn self-host nặng nhất → thu hẹp phạm vi. |

D15–D19 (chi tiết kỹ thuật bổ sung) **đã chốt 2026-06-16** — xem §11.

---

## 1. Hai trục yêu cầu mới — tổng quan

```
                 ┌─────────────────────────────────────────┐
   TRỤC A         │  packages/core  (domain-agnostic ENGINE) │   fork → SaaS khác
   tái dùng       │  auth · RBAC · RLS helpers · ledger ·     │   (kế toán, …)
                 │  workflow engine · checkout · audit ·     │
                 │  notifications · tenant scoping           │
                 └───────────────┬─────────────────────────┘
                                 │ inject product config
                 ┌───────────────▼─────────────────────────┐
                 │  apps/app (HevaSEO PRODUCT)              │
   TRỤC B         │  services/packages · workflow states ·   │   white-label →
   scale ngang    │  role names · branding(tokens)           │   nhiều tenant 1 deploy
                 └───────────────┬─────────────────────────┘
                                 │ deploy đa node (D12)
       LB → [web ×N] → pooler → PG primary (+read replicas) ; [worker ×M] ; Realtime cluster ; Redis
```

**Nguyên tắc xuyên suốt:** code trong `packages/core` **không bao giờ import** thứ riêng của HevaSEO. Mọi đặc thù sản phẩm (catalog, tên trạng thái, tên vai, thương hiệu) là **dữ liệu/cấu hình tiêm vào**, không phải hằng số hardcode. Đây là điều kiện để fork.

---

## 2. TRỤC A — Lõi tái dùng (forkable core)

### 2.1 Ranh giới core ↔ product (D10)

```
packages/
  core/    ← engine domain-agnostic. Xuất: SQL migrations cho bảng lõi,
             RLS policy helpers, hàm ledger, workflow engine, RBAC,
             checkout/Stripe, notifications, audit. KHÔNG biết "SEO" là gì.
  ui/      ← design tokens (theme-able cho white-label)
apps/
  app/     ← SẢN PHẨM HevaSEO: định nghĩa services/packages, workflow states,
             tên vai, branding. Consume packages/core.
  web/     ← marketing HevaSEO (Astro)
```

**Fork một SaaS mới** (vd kế toán) = repo mới, mang theo `packages/core` + `packages/ui`, viết `apps/app` mới với product config khác (workflow kế toán, vai "accountant/client/partner", catalog dịch vụ kế toán). Core không đổi → vá/nâng cấp core lan sang mọi fork.

> **Chống over-engineering:** KHÔNG xây "no-code platform". HevaSEO là **reference implementation**; core được trích ra *từ* nó với ranh giới nghiêm ngặt, không phải khung trừu tượng vẽ trước. Quy tắc thực thi: lint chặn `packages/core` import từ `apps/*`.

### 2.2 Workflow data-driven, KHÔNG hardcode enum (D15 đề xuất)

Để fork sang nghiệp vụ khác, pipeline trạng thái phải là **dữ liệu**, không phải Postgres enum cứng:

```
workflow_states(product, key, label, is_terminal, ...)        -- mỗi product tự định nghĩa
allowed_transitions(product, from_state, to_state, by_role)   -- ma trận chuyển hợp lệ
```

- HevaSEO seed: `New→Confirmed→Assigned→In progress→Internal review→Delivered→(Approved→Completed | Changes requested→In progress)` + `Canceled`.
- SaaS kế toán seed bộ trạng thái khác — **không đụng code engine**.
- Engine `advance_order(order_id, to_state, actor)` chỉ tra `allowed_transitions` → fork chỉ cần đổi seed.
- Đánh đổi: mất type-safety của enum, đổi lấy khả năng fork. Chấp nhận (validate ở function + FK tới `workflow_states`).

### 2.3 RBAC theo capability, role name là product-config (D16 đề xuất)

Core không hardcode "customer/admin/staff" mà dùng **capability** trừu tượng:

| Capability (core) | HevaSEO map | Kế toán map (ví dụ) |
|---|---|---|
| `CLIENT` (xem đơn của mình, nghiệm thu) | customer | client |
| `OPERATOR` (intake, phân việc, full) | admin | partner |
| `EXECUTOR` (làm task được gán) | staff | accountant |

RLS viết theo capability; product chỉ ánh xạ tên vai → capability. Fork đổi nhãn, giữ logic.

### 2.4 White-label qua `tenant_id` (D11)

- **Mọi bảng lõi mang `tenant_id`**; mọi RLS policy có thêm `tenant_id = current_tenant()`.
- HevaSEO 1 thương hiệu = 1 tenant (hằng). White-label nhiều thương hiệu = nhiều tenant **trong cùng deploy**; branding lấy từ `tenants.theme` (tokens override).
- "SaaS hoàn toàn khác" (kế toán) = **fork** (DB riêng) — không nhồi chung tenant với HevaSEO.
- **Vì sao làm ngay:** thêm `tenant_id` lúc đầu rẻ; retrofit multi-tenancy sau khi đã có dữ liệu là một trong những refactor đau nhất. Đây là loại "đắt để thêm sau, rẻ để thêm bây giờ".

---

## 3. TRỤC B — Scale self-host ngang (100k users / 10k đồng thời — D12)

### 3.1 Topology đa node (thay "1 VPS + Docker Compose")

```
                         ┌── Caddy/HAProxy LB (TLS, sticky cho WS) ──┐
                         │                                           │
   hevaseo.com (CDN) ────┤   app.hevaseo.com → [Next web ×N stateless]
   (Astro static)        │                          │
                         │                    Supavisor/PgBouncer (pooler, transaction mode)
                         │                          │
                         │                    PG primary ──logical repl──► PG read replica(s)
                         │                          │                         ▲
   [BullMQ worker ×M] ───┘                          │            (đọc dashboard/analytics)
                                                Redis (queue + cache + rate-limit)
                                                Realtime cluster (chỉ notifications)
                                                Object storage (MinIO/S3) + CDN cho deliverable
```

**Định cỡ thô (10k concurrent ≈ 1–3k RPS đỉnh):**
- App: Next standalone **stateless** (session trong cookie/JWT, không state in-memory) → chạy N instance sau LB, scale theo RPS (~5–15 instance).
- DB: **không** mở 10k kết nối tới Postgres — **pooler bắt buộc** (multiplex về ~50–200 backend conn). Đọc nặng (bảng điều khiển, analytics) route sang **read replica**; ghi vào primary.
- Realtime: 10k websocket là **điểm nghẽn self-host nặng nhất** → giới hạn phạm vi (D14), cluster nhiều node, LB sticky.
- Worker/Redis/Storage: scale ngang dễ.

### 3.2 Balance authoritative — bỏ `SUM(ledger)` mỗi lần (D13, sửa R2)

`SUM(credit_ledger)` mỗi lần check là O(số dòng) → chết ở 100k users. Thay bằng **cột balance quyền lực**, cập nhật nguyên tử trong cùng transaction với ledger:

```sql
-- create_order: vừa atomic vừa O(1), KHÔNG cần advisory lock
update customer_balances
   set balance = balance - v_price
 where customer_id = p_customer and tenant_id = p_tenant
   and balance >= v_price;                       -- điều kiện = khoá hàng + guard cùng lúc
if not found then raise exception 'INSUFFICIENT_CREDIT'; end if;
insert into orders(...) returning * into v_order;
insert into credit_ledger(tenant_id, customer_id, amount, order_id, kind)
       values (p_tenant, p_customer, -v_price, v_order.id, 'debit');
perform write_audit('order.created', ...);
```

- `UPDATE ... WHERE balance >= price` tự **lock hàng + kiểm tra** trong một câu → hết race condition, không cần `pg_advisory_xact_lock`, không cần SUM.
- `credit_ledger` vẫn là **audit append-only** (nguồn sự thật lịch sử).
- **Job đối soát định kỳ**: khẳng định `customer_balances.balance == SUM(credit_ledger)` cho từng customer; lệch → cảnh báo. Đây là lưới an toàn cho cột cache.
- `cancel_order` (D1 refund) và topup làm đối ứng: `balance = balance + amount` + ledger `kind='refund'/'topup'`.

### 3.3 Phân vùng & chỉ mục cho bảng tăng vô hạn (D17 đề xuất)

- `credit_ledger`, `audit_log`, `notifications` **append-only, tăng tuyến tính theo user** → **partition theo tháng** (`PARTITION BY RANGE (created_at)`) + chính sách archive/detach partition cũ.
- **Mọi cột trong predicate RLS phải có index**: `tenant_id`, `customer_id`, `assignee_id`, `order_id`, `status`. RLS thêm `WHERE` ngầm — không index = full scan, giết perf ở scale. Index composite `(tenant_id, <khoá>)` vì RLS luôn có `tenant_id`.

### 3.4 Caching & giảm tải DB
- Redis cache cho dữ liệu nóng ít đổi: `services/packages` (catalog), `workflow_states`, `tenants.theme`.
- Marketing đã tĩnh + CDN. File deliverable qua object storage + CDN, không stream qua app.
- Read replica gánh truy vấn analytics/bảng điều khiển nặng.

### 3.5 Realtime thu hẹp (D14)
- v1: Realtime **chỉ** đẩy `notifications` (RLS theo `user_id` + `tenant_id`). Mỗi user 1 socket nhẹ.
- `messages` (kể cả staff-direct chat — D2): **polling/refetch on focus** ở v1, không socket live → tiết kiệm hàng nghìn kết nối. Nâng lên realtime khi đã có cluster ổn (Phase 3+).

---

## 4. Nguyên tắc nền (RLS = nguồn sự thật, không bypass — R1)

- Truy vấn theo ngữ cảnh user đi qua Supabase client mang **JWT của user** (`@supabase/ssr` đọc cookie) → RLS enforce, **kèm `tenant_id`**.
- `service_role` chỉ ở 3 chỗ không có user context: **Stripe webhook**, **BullMQ worker**, **migration/seed**. Lint chặn import ngoài 3 nơi này (D18).
- Logic nhạy cảm nằm trong **DB function SECURITY DEFINER** (transaction + audit): `create_order`, `advance_order`, `cancel_order`, `topup`. App **không** UPDATE thẳng `status`/`balance` — RLS chặn, chỉ function được phép.
- **Test RLS theo vai + theo tenant**: "vai X / tenant A cố đọc dữ liệu vai Y / tenant B → 0 dòng".

---

## 5. Phân vai & ma trận "ai thấy gì" (theo capability §2.3, +tenant)

| Đối tượng | CLIENT (customer) | EXECUTOR (staff, được gán) | OPERATOR (admin) |
|---|---|---|---|
| `orders` (trong tenant) | ✅ của mình | ✅ đơn được gán | ✅ full |
| Giá / `credit_ledger` / `balance` | ✅ của mình | ❌ **ẩn hoàn toàn** | ✅ full |
| `tasks` / assignee | ❌ | ✅ task của mình | ✅ full |
| `messages` `customer` | ✅ đọc+gửi | ✅ đọc+gửi *(D2)* | ✅ |
| `messages` `internal` | ❌ | ✅ đọc+gửi | ✅ |
| `deliverables` | ✅ bản đã duyệt | ✅ bản mình nộp | ✅ |
| `audit_log` | ❌ | ❌ | ✅ |

Mọi dòng đều **ngầm scope `tenant_id`** — cross-tenant = vô hình tuyệt đối.

---

## 6. Data model (~10 bảng lõi + cột scale/tenant)

| Bảng | Cột đáng chú ý (mới so với master-plan) |
|---|---|
| `tenants` | 🆕 `theme`, `domain` — gốc của white-label |
| `profiles` | `tenant_id`, `capability` (CLIENT/OPERATOR/EXECUTOR), `role_label` |
| `customers` | `tenant_id`, `claimed_at` |
| `services`, `packages` | `tenant_id`, giá đọc server-side |
| `orders` | `tenant_id`, `state` (FK `workflow_states`), `source` |
| `tasks` | `tenant_id`, `assignee_id`, `deadline`, `priority` |
| `deliverables` | `tenant_id`, `version`, `review_status` |
| `messages` | `tenant_id`, `visibility`(internal/customer), `author_id` |
| `notifications` | `tenant_id`, `user_id` — Realtime + **partition tháng** |
| `credit_ledger` | `tenant_id`, `amount`, `order_id`, `kind`, `stripe_event_id` UNIQUE — **partition tháng** |
| 🆕 `customer_balances` | `tenant_id`, `customer_id`, `balance` — **cột authoritative O(1)** (D13) |
| 🆕 `workflow_states`, `allowed_transitions` | pipeline data-driven (§2.2) |
| `audit_log` | `tenant_id`, append-only — **partition tháng** |

---

## 7. Quick checkout — luồng & 6 chốt (giữ từ v2, +tenant)

```
hevaseo.com (island: email+website+gói) ─POST(CORS+Turnstile)→ /api/public/checkout
  → verify Turnstile → tra giá theo package_id + tenant từ DB → Stripe Checkout session
  → webhook (idempotent qua stripe_event_id UNIQUE)
  → materialize_order(): tìm/tạo user theo email → ledger(+topup) → create_order(−debit, cập nhật balance)
  → email report + magic link claim
```

6 chốt bắt buộc: **(1)** giá server-side · **(2)** rate limit (Redis) + Turnstile · **(3)** webhook idempotent · **(4)** chỉ magic link, không mật khẩu · **(5)** chống email-collision (match-by-email chỉ link shadow account `claimed_at IS NULL`; trùng tài khoản đã claim → gắn đơn + magic link, không auto-login) · **(6)** reconciliation job poll Stripe phòng webhook trễ/mất.

---

## 8. Hạ tầng vận hành (self-host đa node — D3/D12)

- **Realtime** chỉ `notifications`, RLS theo `user_id`+`tenant_id`, cluster + LB sticky (D14).
- **Storage**: object storage (MinIO/S3) + CDN; bucket policy scope tenant+customer.
- **Jobs (worker ×M)**: nhắc deadline, SLA, email digest, **reconcile Stripe**, **đối soát balance vs ledger**.
- **Email**: React Email + SMTP.

### Checklist ops (nặng hơn vì scale ngang — đừng đánh giá thấp)
- [ ] PG: primary + read replica(s) + **pooler (Supavisor/PgBouncer transaction mode)**; backup WAL + test restore.
- [ ] App/worker stateless → autoscale/manual scale sau LB; rolling deploy.
- [ ] Realtime cluster: theo dõi số kết nối, load logical replication.
- [ ] Partition maintenance job (tạo partition tháng mới, archive cũ).
- [ ] Observability: metrics + tracing + alert (RPS, p95 latency, pool saturation, replica lag, Redis mem, disk).
- [ ] Secrets qua env; `service_role` key chỉ ở `web`/`worker`; Kong/pooler không lộ port nội bộ.

---

## 9. Khoảng cách Plan ↔ Code hiện tại

| Hạng mục | Trạng thái |
|---|---|
| `(portal)` UI khách (mock) | ✅ shell + full portal pages |
| `(admin)` UI — toàn bộ modules (mock) | ✅ **đầy đủ** (dashboard, orders, customers, staff, analytics, finance, audit, catalog, assignment, tickets, review, settings, managers) |
| `(staff)` UI — Phase 0 mock | ✅ **đầy đủ** (My Day overview, My Tasks board, Task detail, DeliverableSubmit, revision thread, saved-reply snippets, notifications, performance, settings, calendar placeholder) |
| `(staff)` pure logic — `lib/myDay.ts` | ✅ **shipped** — 8 exported functions, 55 tests |
| auth, middleware, RLS | ❌ (Phase 1) |
| `packages/core`, schema, DB functions, tenant_id | ❌ (Phase 1 vertical slice — §14.1) |
| Stripe wiring, pooler, replica, partition | ❌ (Phase 2+) |
| Nguồn dữ liệu | ⚠️ `src/data/adminMock.ts` + `staffMock.ts` (Phase 0 mock-first) |

> ⚠️ Seam `mock.ts` "swap → UI untouched" là **lạc quan quá**: query thật async, phân trang, **scope theo role + tenant**, shape khác theo vai → Server Components phải tái cấu trúc. Lường trước viết lại tầng đọc.

**Phase 0 (mock UI) đã hoàn thành** — mọi màn hình admin + staff đã build trên mock data. Bước tiếp theo: vertical slice backend thật (§14.1) — Supabase auth + bảng lõi + 1 vòng order end-to-end.

---

## 10. Lộ trình phase (Phase 0 mở rộng cho core + scale + tenant)

| Phase | Nội dung |
|---|---|
| **0 — Nền móng** | (a) Chốt data-access model (§4); (b) **dựng `packages/core` boundary** + lint chặn import ngược; (c) schema lõi **có `tenant_id`** + `workflow_states`/`allowed_transitions` + `customer_balances`; (d) RLS theo capability+tenant; (e) DB functions (`create_order` O(1) balance, `advance_order`, `cancel_order`, `topup`); (f) **pooler + 1 read replica** trong docker-compose; (g) partition tháng; (h) **test RLS theo vai+tenant**. |
| **1 — MVP điều phối** | Auth + 3 vai (map capability), CRUD đơn qua function, phân việc, đổi trạng thái, upload deliverable, notification + Realtime (RLS-checked). Đọc qua JWT-scoped client. |
| **2 — Tiền & nghiệm thu** | Credit ledger UI, **quick checkout (6 chốt)**, Approve/Request changes, messaging 2 tầng (staff direct, polling). |
| **3 — Vận hành sâu & scale-out** | Audit UI, workload staff, SLA, analytics (đọc replica), reconcile jobs, **nâng messages lên realtime nếu cần**, tải thử 10k concurrent. |
| **4 — Forkability & polish** | Trích `packages/core` sạch (fork thử 1 SaaS demo), white-label tenant thứ 2, mobile, export, email digest. |

---

## 11. Quyết định kỹ thuật bổ sung (D15–D19) — đã chốt 2026-06-16

- **D15** ✅ Workflow **data-driven** (`workflow_states` + `allowed_transitions`), không dùng enum cứng — điều kiện để fork.
- **D16** ✅ RBAC theo **capability** (CLIENT/OPERATOR/EXECUTOR); product ánh xạ tên vai.
- **D17** ✅ **Thiết kế partition tháng ngay Phase 0** (schema sẵn sàng) cho `credit_ledger`/`audit_log`/`notifications`; bật/maintenance khi dữ liệu lớn.
- **D18** ✅ Lint chặn import `service_role` ngoài 3 nơi cho phép **và** chặn `packages/core` import `apps/*` — bật từ Phase 0.
- **D19** ✅ **Read replica cấu hình từ Phase 0**, route truy vấn đọc nặng sang replica sớm để tránh refactor về sau.

---

## 12. Tổng kết
v3 giữ nguyên hướng vững của master-plan, siết 5 chỗ "tầng giữa" của v2 (RLS-không-bypass, credit nguyên tử, state machine ở DB, quick checkout chống takeover + reconcile, worker riêng), và thêm 2 trục mới:
**(A) Lõi tái dùng** — ranh giới `core/product` nghiêm ngặt + workflow data-driven + RBAC capability + `tenant_id` từ ngày 1 → fork sang SaaS khác và white-label mà không sửa engine.
**(B) Scale self-host ngang** — balance O(1) thay `SUM`, pooler + read replica, partition bảng append-only, index mọi cột RLS, realtime thu hẹp, topology đa node stateless → phục vụ 100k users / 10k đồng thời.
Hai trục này phải vào **Phase 0** vì đều thuộc loại "đắt để retrofit": tenant_id, ranh giới core, và mô hình balance không thể nhồi sau khi đã có dữ liệu và code.

---

## 13. Eng review 2026-06-26 — chốt scope & siết (SUPERSEDES Phase 0 ở §10)

> Phiên `/plan-eng-review`. **Trim Phase 0**: chỉ giữ thứ "rẻ-bây-giờ / đau-retrofit"; hoãn thứ speculative không đau khi thêm sau.

### 13.1 Phase 0 GIỮ (đắt để retrofit)
- `tenant_id` + RLS scope tenant trên mọi bảng (white-label xác nhận là thật → giữ).
- Balance authoritative O(1) (D13) + `credit_ledger` audit append-only.
- RLS-first + DB functions SECURITY DEFINER; `service_role` chỉ 3 nơi (D18).
- Index mọi cột RLS predicate; schema **sẵn sàng** partition tháng (chưa bật).
- Webhook idempotent (`stripe_event_id` UNIQUE).

### 13.2 Phase 0 HOÃN (không đau khi thêm sau)
- **Workflow data-driven** (`workflow_states`/`allowed_transitions`) → **thay bằng typed state machine** (TS union + Postgres enum/CHECK, transition validate trong `advance_order()`). Trích bảng data-driven khi fork product thứ 2.
- **Tách `packages/core`** thật → Phase 4 (trích TỪ HevaSEO, không vẽ khung trừu tượng trước). Phase 0 chỉ giữ lint chặn `apps/* → core`.
- **Read-replica routing (D19)** → chừa seam read-client, chạy single-primary tới khi tải đòi.
- **Realtime cluster** → 1 node; chỉ notifications (D14).

### 13.3 Siết bắt buộc (outside voice surface — đều là đúng/bảo mật)
- **C1 — `_apply_ledger_entry(tenant, customer, amount, kind, order_id)`**: 1 helper SECURITY DEFINER lo balance+ledger+audit nguyên tử; `create_order`/`cancel_order`/`topup` gọi nó. Chống trôi lệch.
- **H1 — refund-on-cancel guard**: `cancel_order` cần **idempotency key + status guard** (`where status='active'`) → double-cancel/retry KHÔNG credit 2 lần. (Bề mặt gian lận thật.)
- **H2 — `materialize_order` 1 transaction**: find-create-topup-order bọc chung tx (hoặc saga + bù). Topup commit mà order fail = bán credit không đơn → cấm.
- **H3 — reconciliation phát hiện orphaned topup**: job hiện chỉ check `balance==SUM(ledger)` → topup mồ côi VẪN PASS. Thêm check: mọi topup phải có order/ý định tương ứng.
- **H4 — email-proof trước merge**: match-by-email chỉ merge SAU khi magic link chứng minh sở hữu email; tài khoản đã claim không bao giờ auto-merge.
- **H5 — worker tenant guard**: worker chạy `service_role` (RLS off) → thêm assertion/wrapper bắt buộc filter `tenant_id`; thiếu = rò rỉ cross-tenant im lặng.

### 13.4 Messages transport
Polling cho MVP (đúng, ít infra khi tải nhỏ) → **chuyển realtime cluster ở Phase 3** khi scale-out (ở 10k concurrent polling tệ hơn realtime).

### 13.5 NOT in scope (cân nhắc & hoãn có chủ đích)
- HA/failover cho PG primary (SPOF ghi) — Phase 3+, sau khi có tải thật.
- Bảng workflow data-driven & core extraction — Phase 4 (forkability).
- Read-replica routing, realtime cluster, bật partition — Phase 3 scale-out.
- Tải thử 10k concurrent — Phase 3.

### 13.6 Failure modes (codepath mới × rủi ro production)
| Codepath | Cách hỏng | Test? | Error handling? | User thấy gì |
|---|---|---|---|---|
| `create_order` đồng thời | race → balance âm | **bắt buộc** concurrency test | `UPDATE..WHERE balance>=price` (lock+guard) | INSUFFICIENT_CREDIT rõ ràng |
| `cancel_order` retry | double-refund (đúc credit) | **bắt buộc** (H1) | idempotency key + status guard | — (chặn ngầm) |
| webhook `materialize_order` | topup commit, order fail | **bắt buộc** (H2) | 1 transaction + reconcile (H3) | email magic link trễ |
| worker `service_role` | quên filter tenant → leak | **bắt buộc** RLS-off guard test | assertion wrapper (H5) | leak IM LẶNG nếu thiếu → **critical** |
| match-by-email | account takeover | **bắt buộc** (H4) | email-proof trước merge | — |

**Critical gap nếu bỏ H5:** leak cross-tenant qua worker là *im lặng* (không RLS đỡ, không lỗi user thấy) → phải có guard + test.

### 13.7 Implementation Tasks (từ findings phiên này)
- [ ] **T1 (P1)** — DB functions — `_apply_ledger_entry` helper + refactor `create_order`/`cancel_order`/`topup` gọi nó. Verify: unit test 3 function cho cùng 1 ledger+audit shape.
- [ ] **T2 (P1)** — `cancel_order` — idempotency key + `status='active'` guard (H1). Verify: double-cancel test → 1 refund.
- [ ] **T3 (P1)** — webhook — `materialize_order` trong 1 transaction (H2) + reconciliation bắt orphaned topup (H3). Verify: inject order-fail → không còn credit mồ côi.
- [ ] **T4 (P1)** — auth/checkout — email-proof trước merge, cấm auto-merge tài khoản đã claim (H4). Verify: takeover attempt test.
- [ ] **T5 (P1)** — worker — assertion wrapper bắt buộc `tenant_id` filter (H5). Verify: RLS-off cross-tenant leak test.
- [ ] **T6 (P1)** — schema/functions — typed state machine (enum/CHECK + `advance_order` validate). Verify: invalid transition test.
- [ ] **T7 (P2)** — lint — chặn `apps/* → packages/core` + `service_role` ngoài 3 nơi (D18).
- [ ] **T8 (P2)** — read path — seam read-client (chừa chỗ cho replica, chạy primary). Verify: 1 điểm đổi connection.
- [ ] **T9 (P2)** — dashboard — query join/batch tránh N+1 khi list orders+assignee+latest message.

### 13.8 Parallel lanes (Phase 0)
- **Lane A (sequential, `packages/core` DB):** T6 → T1 → T2 → T3. Cùng đụng DB functions/ledger.
- **Lane B (independent):** T5 (worker) — module riêng.
- **Lane C (independent):** T4 (auth/checkout) — đụng auth + webhook; phối hợp với T3 ở điểm `materialize_order`.
- **Lane D (independent):** T7 (lint config).
- Khởi động A + B + D song song; C chờ T3 xong (chung `materialize_order`).

## 14. CEO review 2026-06-26 — SCOPE REDUCTION (product-first)

> Premise challenge: 8 commit gần nhất toàn admin UI trên `mock.ts`; chưa có auth/DB/RLS (§9). Đang đánh bóng buồng lái trước khi có động cơ. Outcome thật = khách trả tiền mua dịch vụ SEO + vòng order chạy end-to-end. **Mode: SCOPE REDUCTION, approach: product-first vertical slice.**

### 14.1 Vòng doanh thu tối thiểu (MUST SHIP TOGETHER)
1. Supabase thật + auth magic link, 1 tenant HevaSEO (giữ `tenant_id`).
2. Bảng lõi tối thiểu: `profiles, services/packages, orders, tasks, deliverables, credit_ledger, customer_balances` (+ tenant_id).
3. RLS capability+tenant — 4 policy critical (ẩn tiền khỏi staff · scope assignee · messages D2 · cross-tenant).
4. DB functions: `_apply_ledger_entry`, `create_order` (O(1) guard), `advance_order` (typed SM), `topup`, `cancel_order` (+H1 idempotency).
5. MỘT vòng khách: nạp credit → mua 1 dịch vụ → order(debit) → admin gán staff → staff nộp deliverable → khách approve → completed.
6. Swap 1 trang khỏi mock sang data thật (chứng minh seam rewrite §9).

### 14.2 Fast-follow (ngay sau loop)
- Stripe quick checkout (6 chốt §7). Onboard vài khách đầu bằng admin-granted credit để validate, gắn Stripe liền sau.

### 14.3 NOT in scope (CEO — deferred có chủ đích)
- `packages/core` extraction + white-label tenant #2 → chỉ khi có product #2.
- Scale-out: read replica, partition bật, realtime cluster, tải thử 10k → khi có tải thật.
- Mở rộng admin UI vượt mức đã build (audit/finance/payouts trên mock) → giữ nguyên, wire sau, đừng polish thêm tới khi loop thật chạy.

### 14.4 Dream-state delta
`mock cockpit, 0 user` → **[slice này]** vòng order thật + vài khách trả tiền → platform/scale CHỈ khi demand chứng minh. Đặt công vào phía cầu trước phía cung.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | SCOPE_REDUCTION | product-first: cắt về vòng doanh thu tối thiểu (§14); admin-UI-on-mock investment flagged as proxy work |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | not installed |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_found | Step 0 scope reduced; 4 sections, 8 findings folded; 1 critical gap (H5 worker leak) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE VOICE (Claude subagent):** 8 findings — 4 gap thật folded (H1 refund idempotency, H2/H3 materialize tx + orphaned topup, H4 email-proof, H5 worker guard), 2 cross-model tension resolved (tenant_id → giữ; messages → polling MVP rồi realtime Phase 3), 2 trùng/low.
- **CROSS-MODEL:** đồng thuận trên trim Phase 0 + các siết bảo mật; bất đồng đã chốt: tenant_id GIỮ, messages polling→realtime Phase 3.
- **VERDICT:** ENG + CEO CLEARED — eng (SCOPE_REDUCED, §13) + CEO (SCOPE_REDUCTION product-first, §14) đồng thuận: build vòng doanh thu tối thiểu thật trước, hoãn platform/scale/admin-polish. Sẵn sàng implement vertical slice §14.1. Design review optional, chưa chạy.

NO UNRESOLVED DECISIONS

---

## 15. Staff surface — Phase 0 completion (2026-06-26)

Phase 0 mock UI cho `(staff)` surface đã hoàn thành. Tổng kết những gì đã build:

### 15.1 Màn hình đã ship

| Route | Trạng thái | Ghi chú |
|---|---|---|
| `/staff` — My Day | ✅ **revamped** | 2-column overview dashboard (xem §15.2) |
| `/staff/tasks` | ✅ | Board + table toggle, filter, search, j/k keyboard |
| `/staff/tasks/[id]` | ✅ | Brief + checklist + DeliverableSubmit + revision thread + saved-reply snippets |
| `/staff/deliverables` | ✅ | Submission history |
| `/staff/performance` | ✅ | Self scorecard (read-only mirror module-7) |
| `/staff/notifications` | ✅ | Grouped unread/read |
| `/staff/settings` | ✅ | Profile + AvailabilityToggle + time-off request |
| `/staff/calendar` | ✅ (placeholder) | Deadline calendar |

### 15.2 My Day — full overview dashboard

Trang My Day được revamp từ "Focus list đơn giản" thành **overview dashboard 2 cột** với:

- **5 KPI tiles** — Load / Overdue / Due today / Cleared today / On-time
- **Focus table** — CSS grid `grid-cols-[8rem_7rem_10.5rem_minmax(0,1fr)_auto]` với column headers (TASK · DUE · STATUS · BRIEF · ACTION), zebra stripes (`bg-foreground/[0.05]`), hover highlight
- **Urgency grouping** — Overdue / Due today / This week / Later
- **Filter chips** — All / Assigned / In progress / Changes requested
- **Search** — press `/` to focus; `matchesQuery` trên code + service
- **Inline actions** — Start (1-click) / Resume (1-click) / Submit (slide-over với DeliverableSubmit)
- **Keyboard** — `j`/`k` navigate · `Enter` open · `Space` run action · `/` search · `Esc` close
- **Undo toast** — 5 giây sau Start/Resume
- **Cleared today feed** — tích lũy trong session
- **Context rail** (right column) — Recent pay · Manager note · Latest review · Customers

### 15.3 Pure logic module — `lib/myDay.ts`

Module thuần TypeScript (không React, không tiền) với 8 exported functions:

```ts
primaryActionFor(status) → StaffAction | null
applyAction(state, id, at, makeId) → MyDayState      // optimistic
undoAction(state, entryId) → MyDayState
deriveKpis(state) → MyDayKpis
urgencyGroup(days) → UrgencyKey
groupFocus(tasks) → FocusGroup[]
matchesQuery(task, q) → boolean
filterFocus(tasks, status, q) → MyDayTask[]
```

**55 vitest tests** — tất cả passing. Chạy: `pnpm --filter @heva/app test`

### 15.4 DeliverableSubmit — customer message field

`DeliverableSubmit.tsx` nay có 2 textarea:
1. **Note for the reviewer** — internal, required (submit disabled khi rỗng)
2. **Message to the customer** — optional, client-visible

Cả hai: `min-h-[9.5rem]`, auto-grow khi type (`el.style.height = el.scrollHeight + 'px'`), `resize-none overflow-hidden`.

`onSubmit(note: string, customerNote?: string)` — signature carry cả hai.

### 15.5 Security invariants (CRITICAL)

Các bất biến bảo mật được enforce ở tầng TypeScript, không chỉ runtime:

- `StaffTask = Omit<Task, 'value' | 'price'>` — tiền không thể reach staff component
- `myEarnings()` strip `basis`/`rate` — staff chỉ thấy pay của mình
- `primaryActionFor()` chỉ trả Start/Submit/Resume — không bao giờ Approve/Cancel/reassign
- Staff surface không có button/action nào cho Approve/Deliver/Cancel/price change

**Xem spec đầy đủ:** [staff-surface-design.md §7](2026-06-26-staff-surface-design.md)

## 16. Customer portal surface — Phase 0 completion (2026-06-27)

Phase 0 mock UI cho `(portal)` surface (khách hàng) đã hoàn thiện. Tất cả state là **client-side, session-local** (reset khi reload) qua các React context store — backend nối sau. Tổng kết:

### 16.1 Shared stores (client context, mock)

Mount trong `(portal)/layout.tsx` (lồng trong `ToastProvider`):

| Store | File | Vai trò |
|---|---|---|
| `OrdersProvider` | `OrdersStore.tsx` | `addedOrders` (đơn đặt trong session) + `statusOverrides` (đổi trạng thái tại chỗ) + comments |
| `CreditProvider` | `CreditStore.tsx` | `balance` + `transactions` + `invoices`; `topUp()` / `charge()` → số dư **live toàn app** (header pill, /credit, Settings) |
| `ProjectsProvider` | `ProjectsStore.tsx` | `projects` + `folders` (seed + override + removed); add/update/remove + cascade. Dùng chung bởi /projects, project detail, **và form order** |

Nguyên tắc: store là single source — sửa/tạo/xoá ở 1 nơi phản ánh ngay ở mọi surface (đúng với "Phase 0 = full frontend on mock").

### 16.2 Màn hình & tính năng đã ship

| Route | Tính năng chính |
|---|---|
| `/dashboard` | `DashboardTop` — KPI **live** từ `ORDERS + addedOrders` (Services ordered, service-mix, Order progress) + bộ lọc khoảng thời gian (7/30/90 ngày · All time); specialist chat; CTA New order/Top up |
| `/orders` | `OrdersSummary` strip (Total + đếm theo trạng thái, live) + board |
| `/projects` | `ProjectsStore`; modal New project/folder; gear-menu mỗi card & mỗi folder (edit/delete, cascade); **kéo-thả card vào folder**; empty-state riêng theo folder |
| `/projects/[id]` | Thống kê **live** (gộp đơn session + override); nút **Order a service** preset sẵn Project+Folder; link site (`target=_blank`) |
| `/credit` | `CreditStore` (balance live); top-up trong modal (Card/PayPal/Apple·Google Pay); thống kê đúng theo tháng + "runway days"; **Export CSV** giao dịch; **invoice PDF** (print-ready); click dòng tx/invoice → modal chi tiết |
| `/support` | `SupportClient` — live chat slide-over; modal Connect channel (WhatsApp/Messenger); ticket-detail modal; form ticket hoạt động (thêm vào bảng + file picker) |
| `/settings` | Toggle + Profile/Billing **persist localStorage**; password validate + Copy/Regenerate API key; modal **Manage plan**; **Team** (invite/đổi role/remove); balance live |
| `/services/[svc]` + quick-order panel | **VIP 15% off** (`MEMBERSHIP_DISCOUNT` dùng chung) áp vào summary + cost đơn; sticky order-bar mobile; copy "What's included" |

### 16.3 OrdersBoard — board dùng chung (dashboard · orders · project detail)

`OrdersBoard.tsx` là component board dùng lại trên 3 surface:

- **Kanban / List** — lựa chọn được **nhớ qua reload & sang trang khác** (`localStorage['heva.boardView']`; lưu lúc bấm toggle, đọc lại post-mount).
- **List filters** (chỉ ở List, đặt ở hàng chip dịch vụ bên phải):
  - **Trạng thái** — All / Planned / In progress / In review / Completed (tôn trọng `statusOverrides`).
  - **Thời gian** — All time / Last 7 / 30 / 90 days theo `order.date`, mốc "now" = đơn mới nhất.
- **Cột Manager** — manager phụ trách (`managerFor(id)` từ `MANAGERS`, deterministic). Hiển thị **chức danh** (`· Manager`) + tag **"Reviewing"** khi đơn ở trạng thái In review; ẩn ở cột **Planned** (admin chưa assign → "Not assigned").
- **Chức danh staff** — `STAFF_ROLE[service]` (vd Backlink Specialist, Content Writer…), hiện cạnh tên owner.
- **Columns manager** (ẩn/hiện + kéo sắp xếp, persist) + **Presets** + bộ lọc dịch vụ (chip) + filter project (select).

### 16.4 Order-from-project preset (2026-06-27)

Khi mở form order **từ trong 1 project** (nút "Order a service" ở `/projects/[id]`):

- `QuickOrderButton` gắn `&project=<domain>` vào URL `?neworder=pick`.
- `QuickOrderPanel` đọc `?project=` → truyền `presetDomain` xuống `ServiceOrder`.
- `ServiceOrder` set sẵn **Project = project đó** và **Folder = folder của project đó** (thay vì Auto); vẫn sửa lại được. Nút New order chung và `/services/[svc]` không bị ảnh hưởng (mặc định Auto).

### 16.5 Hạ tầng UI dùng chung

- **`Modal.tsx`** — render qua **portal vào `<body>`** để thoát ancestor có `transform`/`backdrop-filter` (vd header blur, page-transition stagger) → luôn căn giữa đúng. Dùng bởi mọi popup portal (top-up, project/folder, review, ticket…).
- **`SpecialistChat.tsx`** — slide-over chat với SEO lead; nhận `children` để 1 card/nút bất kỳ làm trigger.
- **Page transitions** — `.page-anim > *` cascade (fade + slide nhẹ, stagger ~0.18s, settle ~0.55s) trên mọi trang portal; tôn trọng `prefers-reduced-motion`; transform chỉ trên con trực tiếp nên không phá `sticky`/portal.
- **Touch targets** — `@media (pointer: coarse)` nâng min-height chip/toggle của board lên 40px (desktop giữ nguyên density).
