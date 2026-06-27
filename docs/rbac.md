# RBAC — vai trò & quyền (`@heva/app`)

Tài liệu phân quyền: **ai được thấy gì, làm gì**. Toàn bộ luật nằm gọn trong một file
[`apps/app/src/lib/rbac.ts`](../apps/app/src/lib/rbac.ts) — đó là **nguồn sự thật**, file `.md` này
chỉ diễn giải cho người đọc. Sửa quyền thì sửa `rbac.ts`, rồi cập nhật lại bảng ở đây cho khớp.

> ⚠️ **UI chỉ là lớp khóa thứ hai.** Lớp khóa chính là database (RLS) theo master-plan.
> Module này giúp giao diện nhất quán và tự-tài-liệu, **không** thay cho bảo mật phía server —
> đừng tin nó giữ được một client cố tình phá.

## Mục lục
- [1. Bốn vai trò](#1-bốn-vai-trò)
- [2. Cách hệ thống hoạt động](#2-cách-hệ-thống-hoạt-động)
- [3. Bảng quyền đầy đủ (ma trận)](#3-bảng-quyền-đầy-đủ-ma-trận)
- [4. Hai luật cắt-ngang hay quên](#4-hai-luật-cắt-ngang-hay-quên)
- [5. Công thức làm việc thường gặp](#5-công-thức-làm-việc-thường-gặp)
- [6. Lưới an toàn: drift guard](#6-lưới-an-toàn-drift-guard)
- [7. Cái bẫy umbrella (đọc kỹ)](#7-cái-bẫy-umbrella-đọc-kỹ)
- [8. Bản đồ file](#8-bản-đồ-file)
- [9. Câu hỏi thường gặp](#9-câu-hỏi-thường-gặp)
- [10. Khi backend lên](#10-khi-backend-lên)

---

## 1. Bốn vai trò

| Vai | Vùng route | Một câu mô tả |
|-----|-----------|---------------|
| `admin` | `/admin/*` | Toàn quyền. |
| `manager` | `/admin/*` | Giống admin nhưng **bỏ phần tiền** (Finance, Analytics, giá) và **bỏ quyền tổ chức** (quản lý manager, cài đặt hệ thống). Chỉ lo vận hành. |
| `staff` | `/staff/*` | Việc + kiến thức + hồ sơ của chính mình. Thấy ghi chú nội bộ, **không** thấy giá tiền. |
| `customer` | gốc (`/dashboard`, `/orders`, …) | Cổng khách hàng. Thấy giá/credit của mình, **không** thấy ghi chú nội bộ. |

Cách nhớ nhanh:
- **manager = admin − tiền − quyền-tổ-chức**
- **staff** xoay quanh "việc của tôi", mù về tiền
- **customer** chỉ thấy thứ của chính họ

---

## 2. Cách hệ thống hoạt động

Chỉ có **3 mảnh ghép**, tất cả trong `rbac.ts`:

```
┌─ 1. MA TRẬN ──────────────┐   ┌─ 2. BẢN ĐỒ ROUTE ─────────────┐
│ ROLE_CAPABILITIES         │   │ ROUTE_CAPABILITY              │
│ vai  → các "quyền" nó có  │   │ đường dẫn → quyền cần để vào  │
│ vd: manager có orders.manage│ │ vd: /admin/finance → finance.view│
└───────────────────────────┘   └──────────────────────────────┘
                  │                          │
                  └──────────┬───────────────┘
                             ▼
              ┌─ 3. CÁC HÀM TIỆN ÍCH ──────────────┐
              │ can(vai, quyền)        → true/false │
              │ canAccessPath(vai, url)→ true/false │
              │ filterNav(nav, vai)    → nav đã lọc │
              │ homePathFor(vai)       → trang chủ  │
              └────────────────────────────────────┘
```

**"Quyền" (capability) là gì?** Là một cái tên cho một việc cụ thể, ví dụ `finance.view`
(xem tài chính) hay `pricing.view` (thấy số tiền). Thay vì viết `if (role === 'admin')` rải rác
khắp code, ta hỏi `can(role, 'finance.view')`. Khi luật đổi, chỉ sửa một chỗ — cái ma trận.

**Cùng một ma trận được dùng ở 3 nơi:**

| Nơi | Dùng hàm gì | Để làm gì |
|-----|-------------|-----------|
| Thanh sidebar | `filterNav` | Ẩn các link mà vai đó không được vào |
| Trong component | `can` | Ẩn một mẩu UI (vd ẩn cột giá khỏi staff) |
| Chặn URL trực tiếp | `canAccessPath` | (Sẽ dùng ở middleware khi có backend) chặn gõ tay URL |

---

## 3. Bảng quyền đầy đủ (ma trận)

✅ = có quyền · — = không

| Quyền (capability) | admin | manager | staff | customer | Ý nghĩa |
|---|:--:|:--:|:--:|:--:|---|
| `admin.access` | ✅ | ✅ | — | — | Vào được khu admin |
| `orders.manage` | ✅ | ✅ | — | — | Quản lý đơn |
| `assignment.manage` | ✅ | ✅ | — | — | Phân việc cho staff |
| `review.manage` | ✅ | ✅ | — | — | Duyệt deliverable |
| `tickets.manage` | ✅ | ✅ | — | — | Xử lý ticket hỗ trợ |
| `customers.manage` | ✅ | ✅ | — | — | Quản lý khách |
| `staff.manage` | ✅ | ✅ | — | — | Quản lý nhân sự staff |
| `managers.manage` | ✅ | — | — | — | Quản lý các manager |
| `catalog.manage` | ✅ | ✅ | — | — | Sửa bảng dịch vụ/giá gốc |
| `audit.view` | ✅ | ✅ | — | — | Xem nhật ký hệ thống |
| `org.settings` | ✅ | — | — | — | Cài đặt toàn tổ chức |
| `finance.view` | ✅ | — | — | — | Doanh thu, lương, dòng tiền |
| `analytics.view` | ✅ | — | — | — | Phân tích kinh doanh |
| `staff.access` | — | — | ✅ | — | Vào được khu staff |
| `staff.work` | — | — | ✅ | — | My Day, task, lịch, nộp bài |
| `staff.knowledge` | — | — | ✅ | — | Docs, notes |
| `staff.self` | — | — | ✅ | — | Tài chính/hiệu suất/cài đặt của mình |
| `portal.use` | — | — | — | ✅ | Dùng cổng khách hàng |
| `pricing.view` | ✅ | ✅ | — | ✅ | Thấy số tiền trên đơn |
| `notes.internal.view` | ✅ | ✅ | ✅ | — | Thấy ghi chú/thread nội bộ |

> Đọc **theo cột** để hiểu một vai có gì. Đọc **theo hàng** để soi một quyền cho ai —
> ví dụ kiểm tra `finance.view` chỉ có dấu ✅ ở cột admin là đúng.

---

## 4. Hai luật cắt-ngang hay quên

Hầu hết quyền gắn với một khu vực. Nhưng **2 luật này áp xuyên mọi màn hình**, và là chỗ dễ làm sai nhất:

**`pricing.view` — staff KHÔNG bao giờ thấy số tiền.**
Master-plan: *"Staff KHÔNG thấy giá tiền/credit."* Khi làm bất kỳ component nào hiển thị tiền
(đơn hàng, hoa hồng, hóa đơn) và component đó **dùng chung** giữa nhiều vai, phải bọc:
```tsx
{can(role, 'pricing.view') && <Price value={order.total} />}
```

**`notes.internal.view` — khách KHÔNG bao giờ thấy ghi chú nội bộ.**
Master-plan: *"Khách KHÔNG thấy ghi chú nội bộ."* Thread tin nhắn có cờ nội bộ/khách —
lọc trước khi render cho customer:
```tsx
const visible = thread.filter(m => m.visibility === 'customer' || can(role, 'notes.internal.view'));
```

---

## 5. Công thức làm việc thường gặp

### A. Thêm một trang admin mới
1. Tạo route, ví dụ `app/admin/reports/page.tsx`.
2. Thêm mục vào `ADMIN_NAV` trong [`data/adminNav.ts`](../apps/app/src/data/adminNav.ts).
3. Quyết định ai thấy:
   - **Admin + manager đều thấy** → xong, không cần làm gì thêm (route `/admin/*` mặc định cần `admin.access`).
   - **Chỉ admin thấy** (vd liên quan tiền) → thêm một dòng vào `ROUTE_CAPABILITY`:
     ```ts
     { prefix: '/admin/reports', capability: 'finance.view' },
     ```
     ⚠️ **Bắt buộc** với trang nhạy cảm về tiền — xem [mục 7](#7-cái-bẫy-umbrella-đọc-kỹ).
4. Chạy `npx vitest run src/lib/rbac.nav.test.ts` để guard xác nhận.

### B. Thêm một quyền (capability) mới
1. Thêm tên vào union `Capability` trong `rbac.ts`.
2. Thêm nó vào những vai cần có, trong `ROLE_CAPABILITIES` (TypeScript ép bạn liệt kê đủ cả 4 vai).
3. Nếu quyền gắn với một route → thêm vào `ROUTE_CAPABILITY`.
4. Dùng: `can(role, 'ten.quyen.moi')`.

### C. Ẩn một mẩu UI khỏi một vai
```tsx
import { can } from '@/lib/rbac';
// role là persona của màn hình hiện tại (xem mục 9)
{can(role, 'pricing.view') && <PriceTag total={order.total} />}
```

### D. Xem trước giao diện của manager
Mở `rbac.ts`, đổi:
```ts
export const ADMIN_PERSONA = 'manager'; // mặc định là 'admin'
```
Mở `/admin` → sidebar sẽ tự rụng Finance / Analytics / Managers / Settings. Đổi lại `'admin'` khi xong.

### E. Thêm một vai mới (vd `auditor`)
1. Thêm `'auditor'` vào type `Role` và mảng `ROLES`.
2. Thêm `auditor: [...]` vào `ROLE_CAPABILITIES` (TypeScript sẽ báo nếu thiếu).
3. Bổ sung `auditor` vào `homePathFor`.
4. Cập nhật bảng ở [mục 3](#3-bảng-quyền-đầy-đủ-ma-trận).

---

## 6. Lưới an toàn: drift guard

File [`rbac.nav.test.ts`](../apps/app/src/lib/rbac.nav.test.ts) chạy cùng test suite và **báo đỏ** khi nav lệch khỏi RBAC.

**Nó bắt được:**
- Một mục nav trỏ tới đường dẫn **không** có quyền nào (vô tình thành public, ai cũng vào).
- Một route mà **mọi vai** đều vào được (dấu hiệu rò rỉ).
- Mục nav không tới được bằng chính persona của khu vực đó.

**Nó KHÔNG bắt được** (cần con người để ý):
- Trang tiền mới đặt dưới `/admin/*` mà quên khai → mặc định manager **vẫn thấy**. Xem mục 7.
- Logic ẩn/hiện sai *bên trong* một component.

> Tóm lại: RBAC **không tự cập nhật** khi bạn thêm tính năng, nhưng guard sẽ **tự nhắc** ở các lỗi rõ ràng nhất.

---

## 7. Cái bẫy umbrella (đọc kỹ)

`ROUTE_CAPABILITY` khớp theo **tiền tố dài nhất trước**. Có hai tiền tố "ô dù" ở cuối danh sách:
`/admin` → `admin.access` và `/staff` → `staff.access`.

Nghĩa là: **một route con admin/staff mới mà bạn quên khai sẽ tự rơi vào quyền nền của khu vực.**

- ✅ **Mặt tốt:** không bao giờ thành public. `/admin/bat-ky-thu-gi` luôn cần ít nhất `admin.access`.
- ⚠️ **Mặt bẫy:** quyền nền `admin.access` thì **manager cũng có**. Nên nếu bạn thêm
  `/admin/finance-v2` mà quên khai riêng, nó sẽ cần `admin.access` → **manager thấy luôn báo cáo tiền**.

👉 **Quy tắc bỏ túi:** thêm bất cứ trang nào dính tới **tiền/doanh thu/lương** dưới `/admin/`,
phải khai một dòng riêng `→ finance.view` (hoặc `analytics.view`) trong `ROUTE_CAPABILITY`. Đừng dựa vào ô dù.

---

## 8. Bản đồ file

| File | Vai trò |
|------|---------|
| [`lib/rbac.ts`](../apps/app/src/lib/rbac.ts) | **Nguồn sự thật** — vai, quyền, ma trận, bản đồ route, các hàm |
| [`lib/rbac.test.ts`](../apps/app/src/lib/rbac.test.ts) | Khóa ma trận: các luật quyền không bị đổi ngầm |
| [`lib/rbac.nav.test.ts`](../apps/app/src/lib/rbac.nav.test.ts) | Drift guard: nav phải khớp RBAC |
| [`data/adminNav.ts`](../apps/app/src/data/adminNav.ts) · [`staffNav.ts`](../apps/app/src/data/staffNav.ts) · [`nav.ts`](../apps/app/src/data/nav.ts) | Danh sách menu của 3 khu vực |
| [`components/admin/AdminSidebar.tsx`](../apps/app/src/components/admin/AdminSidebar.tsx) · [`staff/StaffSidebar.tsx`](../apps/app/src/components/staff/StaffSidebar.tsx) · [`components/Sidebar.tsx`](../apps/app/src/components/Sidebar.tsx) | 3 sidebar, đều gọi `filterNav` |
| `docs/rbac.md` | Tài liệu này |

---

## 9. Câu hỏi thường gặp

**Component lấy biến `role` ở đâu ra?**
Phase 0 chưa có đăng nhập, nên mỗi khu vực render cố định một persona: khu `/staff` luôn là
`'staff'`, cổng khách luôn là `'customer'`, khu `/admin` đọc `ADMIN_PERSONA`. Với component
**dùng chung nhiều khu vực**, hãy nhận `role` qua prop từ shell của khu đó.

**Tại sao admin gõ `/orders` (cổng khách) lại bị chặn?**
Cố ý. `/orders` cần `portal.use`, mà admin không có — khu admin tách bạch với cổng khách.
Admin xem đơn ở `/admin/orders`.

**Đổi quyền có sợ quên chỗ nào không?**
`ROLE_CAPABILITIES` là `Record<Role, …>` nên TypeScript ép đủ cả 4 vai. Còn việc một quyền
nên thuộc vai nào thì test trong `rbac.test.ts` chốt lại các trường hợp quan trọng.

**Thêm route không-có-nav (vd trang chi tiết `/admin/orders/[id]`) thì sao?**
Không cần làm gì — nó nằm dưới ô dù `/admin/orders` → tự kế thừa `orders.manage`.

---

## 10. Khi backend lên

Mọi thứ đang chạy trên persona giả lập. Khi có auth thật:
1. Xóa hằng `ADMIN_PERSONA` (và các persona cố định ở sidebar).
2. Đọc `role` từ session — middleware đã resolve theo master-plan.
3. Bật chặn URL thật ở middleware bằng `canAccessPath(role, request.url)`.

Toàn bộ `can()` / `canAccessPath()` / `filterNav()` / ma trận **giữ nguyên** — chỉ đổi *nguồn* của
biến `role` từ hằng giả lập sang session thật.
