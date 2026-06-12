# HevaSEO Platform — Master Plan

> Kế hoạch tổng thể cho toàn bộ hệ thống HevaSEO: site marketing (Astro) + SaaS điều phối (Next.js).
> Cập nhật lần cuối: 2026-06-12.

---

## 1. Bức tranh tổng

```
hevaseo-platform/  (pnpm monorepo)
├─ apps/web        → Astro, marketing/SEO (✅ XONG)        → hevaseo.com
├─ apps/app        → Next.js, SaaS 3 vai (CHƯA LÀM)        → app.hevaseo.com
└─ packages/ui     → design tokens dùng chung (✅ CÓ SẴN)

Deploy (self-hosted, VPS + Docker Compose):
├─ nginx / Caddy            → reverse proxy + TLS
├─ Astro static files       → hevaseo.com
├─ Next.js (standalone)     → app.hevaseo.com
├─ Supabase self-hosted     → Postgres + Auth + Storage + Realtime
└─ Redis + BullMQ           → background jobs
```

**Mô hình nghiệp vụ:** hệ điều phối dịch vụ SEO —
`Khách hàng → Admin (tiếp nhận, phân việc) → Staff (thực thi, nộp kết quả) → Admin duyệt → Khách nghiệm thu`.
Tất cả thao tác trong một dashboard, phân quyền theo 3 vai.

---

## 2. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Marketing site (Astro): `/`, `/audit`, `/seo-web-design`, `/keyword-strategy`, `/faq`, `/privacy`, `/terms`, `/blog` | ✅ Migrate xong từ HevaSEOen, build sạch 9 trang |
| Shared chrome (Header/Footer/FAB/StickyCta) + `src/data/site.ts` | ✅ Component hoá — sửa 1 nơi, mọi trang đồng bộ |
| Design tokens (`packages/ui`: tailwind-preset + tokens.css) | ✅ Sẵn sàng cho cả Astro + Next |
| Blog (Astro content collection, thêm bài = thả file .md) | ✅ |
| Dashboard demo (HTML tĩnh, mockup) | ✅ Đang polish — **đây là spec UI cho app thật** |
| `apps/app` (Next.js SaaS) | ⬜ Placeholder — chờ polish demo xong thì khởi động Phase 0 |
| Thư mục cũ `HevaSEO/` (VN), `HevaSEOen/` (EN) | **Đã chốt English-only (thị trường Mỹ)** → 2 thư mục này là legacy; zip backup rồi xoá khi xác nhận bản Astro ổn |

---

## 3. Tech stack (đã chốt)

**Tiêu chí chọn: self-hosted + custom sâu + tận dụng open source làm nền (không dùng SaaS boilerplate).**

| Tầng | Công nghệ | Ghi chú |
|---|---|---|
| Marketing | **Astro** (static) | SEO tốt, ship ~0 JS |
| SaaS frontend | **Next.js** (App Router, standalone output) | Open source, tự host bằng Docker — KHÔNG host trên Vercel |
| UI | **Tailwind + shadcn/ui** + tokens từ `packages/ui` | Đồng bộ design với marketing |
| Bảng dữ liệu admin | **Refine** hoặc TanStack Table | CRUD/filter/phân trang nhanh |
| Backend | **Supabase self-hosted** (Docker) | Postgres + Auth + Storage + Realtime + **RLS** |
| Jobs | **Redis + BullMQ** | Nhắc deadline, email digest |
| Email | **React Email** (template) + SMTP provider (SES/Postmark) | Code template của mình, không lock-in |
| Thanh toán | **Stripe** (Checkout + webhook) | Mảnh duy nhất là dịch vụ ngoài |
| Form/validation | react-hook-form + zod | |

**Đã loại và lý do:**
- `next-forge` — đấu dây sẵn vào Clerk/Neon/Resend (SaaS bên thứ ba), ngược tiêu chí self-host.
- `ixartz SaaS-Boilerplate` — bản free thiếu tính năng, đủ thì phải trả phí.
- `BoxyHQ Starter Kit` — lâu không update.
- Fork sản phẩm nguyên con (Worklenz, Plane, ERPNext) — kẹt UI/workflow của họ, trong khi dashboard là điểm bán hàng riêng.

**Tỉ lệ:** ~70–80% sức nặng kỹ thuật do open source gánh (Next, Supabase, Redis, shadcn);
~20–30% code nghiệp vụ tự viết (3 vai, workflow, credit) — chính là giá trị sản phẩm.

---

## 4. Kế hoạch FE (`apps/app` — Next.js)

### Cấu trúc route theo vai (middleware đọc role từ session)
```
(auth)/login, /invite, /claim          ← magic link claim tài khoản
(portal)/…    Khách hàng:  Overview · Orders · Đặt dịch vụ · Credit & Invoices
                            · Nghiệm thu deliverable · Support
(admin)/…     Admin:       Hàng đợi đơn mới (intake) · Phân việc (assignment)
                            · Workload staff · Duyệt deliverable · Quản lý khách
                            · Catalog dịch vụ/giá · Doanh thu & analytics
(staff)/…     Staff:       My tasks · Nộp kết quả (upload report/link) · Lịch deadline
```

### Nguyên liệu
- Server Components đọc dữ liệu + Server Actions ghi; TanStack Query cho phần realtime.
- Port pattern đẹp từ dashboard demo (kanban, credit card, ticker) thành component thật.
- Staff KHÔNG thấy giá tiền/credit; Khách KHÔNG thấy ghi chú nội bộ — chặn từ tầng DB (RLS), UI chỉ là lớp thứ hai.

---

## 5. Kế hoạch BE (Supabase + Next API)

### Data model (~10 bảng lõi)
| Bảng | Vai trò |
|---|---|
| `profiles` | user + role (`customer` / `admin` / `staff`) |
| `customers` | tài khoản doanh nghiệp khách · cột `claimed_at` (đã kích hoạt dashboard chưa) |
| `services`, `packages` | catalog dịch vụ + giá (admin sửa được — hết hardcode) |
| `orders` | đơn dịch vụ — trái tim hệ thống · cột `source: 'quick' \| 'dashboard'` |
| `tasks` | việc admin gán cho staff (1 đơn → n task, deadline, priority) |
| `deliverables` | kết quả staff nộp (file/link, version, trạng thái duyệt) |
| `messages` | thread theo đơn · cờ `visibility: 'internal' \| 'customer'` |
| `notifications` | inbox in-app cho cả 3 vai (Supabase Realtime đẩy live) |
| `credit_ledger` | sổ cái credit (+nạp / −trừ, gắn order) — balance luôn TÍNH TỪ ledger |
| `audit_log` | ai làm gì lúc nào — đúng USP "no black box" |

### State machine trạng thái đơn (CẦN CHỐT TRƯỚC KHI CODE)
```
New → Confirmed → Assigned → In progress → Internal review
    → Delivered → ( Approved → Completed  |  Changes requested → In progress )
    + Canceled (từ New/Confirmed)
```

### Phân quyền (Supabase RLS — tầng DB, không chỉ ẩn nút)
- Khách: chỉ thấy đơn của mình; không thấy `messages` internal, không thấy `tasks`/assignee.
- Staff: chỉ thấy task được gán; không thấy giá tiền & credit.
- Admin: full.

### Hạ tầng
- Storage (Supabase) cho file deliverable.
- Notifications v1 = bảng `notifications` + Supabase Realtime (chưa cần Novu; cân nhắc khi cần digest đa kênh).
- BullMQ jobs: nhắc deadline, SLA reminder, email digest.
- Email touchpoints: xác nhận đơn → (tuỳ chọn) cập nhật tiến độ → giao report + magic link.

---

## 6. Quick checkout trên trang marketing (guest checkout + lazy account)

**Mục tiêu:** khách ngại dashboard vẫn đặt hàng + thanh toán ngay trên hevaseo.com; nhận kết quả qua email; kèm magic link vào dashboard nếu muốn.

**Nguyên tắc: Astro vẫn tĩnh, MỘT backend duy nhất** — đơn từ marketing và từ dashboard rơi vào CÙNG bảng `orders`.

```
hevaseo.com (Astro)
  └─ Form đặt nhanh (island: email + website + chọn gói)
        │ POST
        ▼
app.hevaseo.com/api/public/checkout   → tạo Stripe Checkout session
        ▼
Stripe Checkout (hosted page — Astro không đụng thẻ)
        │ webhook (idempotent!)
        ▼
Supabase: tạo/tìm user theo email (shadow account, KHÔNG mật khẩu)
        + tạo order (source:'quick') + ghi credit_ledger
        ▼
Hàng đợi admin → gán staff → làm → Delivered
        ▼
Email khách: report đính kèm + nút "Xem trong dashboard" (magic link → claim tài khoản)
```

**4 điểm kỹ thuật bắt buộc:**
1. Giá validate ở server — form chỉ gửi `package_id`, server tra giá DB rồi mới tạo session.
2. Chống spam endpoint public: rate limit + Cloudflare Turnstile.
3. Webhook idempotent — check `event_id` trước khi tạo đơn (Stripe có thể bắn trùng).
4. Không gửi mật khẩu qua email — chỉ magic link để khách tự đặt khi claim.

---

## 7. Lộ trình phase

| Phase | Nội dung | Kết quả |
|---|---|---|
| **0 — Chuẩn bị** (song song lúc polish demo) | Chốt state machine + ma trận "ai thấy gì"; schema SQL + RLS policies; docker-compose Supabase local | Nền móng, chưa code UI |
| **1 — MVP luồng điều phối** | Auth + 3 vai, CRUD đơn, phân việc, đổi trạng thái, upload deliverable, notification cơ bản | Khách đặt → admin gán → staff nộp → khách thấy: chạy end-to-end |
| **2 — Tiền & nghiệm thu** | Credit ledger + Stripe, **quick checkout trên Astro (mục 6)**, màn Approve/Request changes, messaging 2 tầng | Thu tiền thật được (cân nhắc đẩy quick checkout lên sớm — ít UI, ra doanh thu) |
| **3 — Vận hành sâu** | Audit log, workload staff, SLA reminders, analytics admin | Scale team |
| **4 — Polish** | Mobile, export PDF/CSV, email digest | Hoàn thiện |

---

## 8. Câu hỏi cần chốt trước Phase 0

1. Bảng trạng thái đơn (mục 5) có khớp quy trình thực tế không?
2. Staff có được chat trực tiếp với khách không, hay mọi giao tiếp qua admin?
3. Credit trừ lúc **đặt đơn** hay lúc **admin confirm**?
4. Đơn quick-checkout: thanh toán thẳng (one-time) hay quy đổi hết về credit ledger? (khuyến nghị: quy hết về ledger cho sổ sách nhất quán)

---

## 9. Quy ước & ghi chú

- Mọi giá hiển thị: USD chính + EUR phụ (`≈ €`), quy đổi nội bộ từ VND ~25.000đ/USD (xem memory `hevaseo-en-localization`).
- Dashboard demo (`apps/web/public/demo/`) là spec UI — phase 1 "thắp điện" cho các màn đã thiết kế, không vẽ lại.
- Chrome (header/footer/FAB) chỉ sửa trong `apps/web/src/components/` — không bao giờ thêm chrome per-page.
- Không commit secrets; `.env` đã ignore.
