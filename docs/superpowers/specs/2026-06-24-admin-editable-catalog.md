# Plan — Admin-editable catalog (single source → marketing + dashboard)

**Date:** 2026-06-24
**Goal:** Admin chỉnh **giá + detail từng dịch vụ** và **các gói upsell** ở MỘT nơi → tự động apply cho **toàn bộ marketing pages (Astro)** lẫn **dashboard người dùng (Next)**.

## Nguyên tắc cốt lõi
Tách **structured data** (admin sửa) khỏi **bespoke content** (giữ trong code):
- **Structured (data-driven, admin-editable):** giá, tên gói, SLA, features, package groups, add-on/tier, discount.
- **Bespoke (ở lại trong từng trang):** graphic, copy hero, bảng so sánh layout, animation.

Mọi consumer đọc từ **1 nguồn** (`@heva/catalog`). Sau này đổi nguồn file → DB (Supabase) mà UI gần như không sửa.

## Trạng thái hiện tại
- ✅ **Add-on / upsell** đã gộp vào `packages/catalog/src/index.ts` (`ADDONS`, multi-tier). Sửa 1 nơi → cả 2 app. Đã wire: marketing (`OrderShell`/`OrderSummary` + tier `<select>`), dashboard (`ServiceOrder` + tier chips).
- ⏳ **Service + gói + giá** vẫn nằm 3 nơi tách rời:
  1. Marketing landing (`apps/web/src/pages/*.astro`) — giá nhúng trong `PricingGrid` tiers + bảng so sánh.
  2. Marketing order data (`apps/web/src/data/orders.ts`).
  3. Dashboard (`apps/app/src/data/services.ts`).

## Các bước cần làm (theo thứ tự)
1. **Mở rộng `@heva/catalog`** thêm `SERVICES`: per service → packages/groups (id, name, price, priceLabel, sla, popular, summary, features), brief fields, bulk/usage config, add-on ids, detail (hero/included/steps/faqs nếu muốn share).
2. **Cho 3 consumer đọc từ shared:**
   - `orders.ts` + `services.ts` → resolve từ shared (nhẹ, cấu trúc gói đã giống).
   - **Landing pages** (nặng nhất): tách dữ liệu giá/gói trong `PricingGrid` tiers + bảng so sánh → đọc từ shared; giữ phần bespoke.
3. **Admin editor UI** (`/settings/catalog`, chỉ staff): CRUD service + gói + giá + add-on/tier. Ghi vào shared.
4. **Backend (Supabase):** loader đọc DB thay file; admin UI gọi API. UI hiển thị không đổi.

## Làm tăng dần
- Bắt đầu gộp **1 dịch vụ (Audit)** end-to-end (landing + order + dashboard cùng đọc 1 nguồn) để chốt shape, rồi nhân ra các dịch vụ còn lại.
- Admin UI + DB làm sau cùng.

## Lưu ý kỹ thuật
- Build config đã sẵn: Next `transpilePackages: ['@heva/catalog']`, Astro `vite.ssr.noExternal: ['@heva/catalog']`.
- `FieldDef` đã hợp nhất (gồm `keyword-rows`). Marketing dùng tier `<select>` (vanilla JS cập nhật data-attr trên checkbox → tái dùng `recomputeTotal`); dashboard dùng React state + chips.

---

## Catalog Analytics UI (built 2026-06-26 — Phase 0 mock)

The `/admin/catalog` page shows **per-package sales metrics** alongside catalog data,
letting admin see at a glance which packages drive the most revenue and customers.

### Time-range filter
A segmented control above the service cards: **7D | 30D | 3M | 6M | 12M | YTD** (default 30D).
All package stats update instantly when the range changes (client state, no network).

### Per-package metric columns (added to each package table)
| Column | Description |
|--------|-------------|
| Orders | Count of orders placed in the selected range |
| Customers | Unique customers who bought the package in the range |
| Revenue | Sum of order value in the selected range |
| LTV | Lifetime value (all-time, range-independent) |

Per-service rollup row shows the aggregate totals across all packages in that service.

### Implementation notes (mock phase)
- Stats are generated deterministically via an FNV-1a hash seed so numbers are stable and
  realistic across re-renders (no flicker, safe for screenshots / demos).
- `pkgStats(pkg, range)` computes range-scoped Orders/Customers/Revenue; `pkgLtv(pkg)` computes
  all-time LTV. LTV is guaranteed ≥ max-range Revenue (1.5–4× annual multiplier).
- A per-range jitter factor keeps numbers from looking perfectly proportional across ranges.

File: `apps/app/src/app/admin/catalog/CatalogClient.tsx`.
