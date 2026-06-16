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
| `(portal)` UI khách (mock) | ✅ shell |
| `(admin)`, `(staff)`, auth, middleware | ❌ |
| `packages/core`, schema, RLS, DB functions, tenant_id | ❌ (chưa tồn tại) |
| Stripe wiring, pooler, replica, partition | ❌ |
| Nguồn dữ liệu | ⚠️ `src/data/mock.ts` |

> ⚠️ Seam `mock.ts` "swap → UI untouched" là **lạc quan quá**: query thật async, phân trang, **scope theo role + tenant**, shape khác theo vai → Server Components phải tái cấu trúc. Lường trước viết lại tầng đọc.

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
