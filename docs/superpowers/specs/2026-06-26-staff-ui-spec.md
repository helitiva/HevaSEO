# Staff UI — spec chi tiết giao diện (Phase 0, mock)

> `/spec` 2026-06-26. Mục tiêu: hoàn thiện full giao diện trang **Staff** (vai EXECUTOR), tái dùng design language + component của Admin, scope theo "task được gán cho mình", **ẩn hoàn toàn tiền**. Mock data; backend làm sau ([[phase0-full-frontend-on-mock]]).

## Context
Staff là người **thực thi** task được admin/manager gán: làm việc, nộp deliverable, chat với khách + nội bộ, theo dõi deadline/hiệu suất của chính mình. Họ KHÔNG bao giờ thấy giá, credit, doanh thu, hay lương người khác. Cần một surface đầy đủ để hình dung + dùng được, đồng bộ thị giác với Admin.

## Verified current state (đã đọc code 2026-06-26)
Staff surface đã được dựng phần lớn trong session này. Không phải greenfield.

| Trang | File | Dòng | Trạng thái |
|---|---|---|---|
| Shell/Sidebar/Topbar | `components/staff/StaffShell|StaffSidebar|StaffTopbar.tsx` | — | ✅ mirror AdminShell (cùng layout grid, page-anim) |
| My Day | `app/staff/page.tsx` | 75 | ✅ focus list + 4 KPI |
| My Tasks (kanban) | `app/staff/tasks/page.tsx` | 57 | ✅ 5 cột board, card → detail |
| Task Detail | `app/staff/tasks/[id]/page.tsx` → `TaskDetailClient` | 25 + client | ✅ server page có prev/next + deep-link; **client cần verify đủ depth** |
| Deliverables | `app/staff/deliverables/page.tsx` | 101 | ✅ lịch sử nộp |
| Performance | `app/staff/performance/page.tsx` | 102 | ✅ scorecard cá nhân |
| Calendar | `app/staff/calendar/page.tsx` | 29 | ⚠️ **thin** — cần làm sâu |
| Notifications | `app/staff/notifications/page.tsx` → client | 12 | ✅ inbox |
| Settings | `app/staff/settings/page.tsx` → client | 24 | ✅ profile + availability |

**Điểm mạnh phải GIỮ (do-not-touch):**
- `staffMock.ts`: `StaffTask` **cố tình bỏ money ở mức type** → leak giá/credit là **lỗi biên dịch**, không phải check runtime. Nguồn dữ liệu chung = `adminMock` ORDERS/DELIVERABLES (không nhân bản). Giữ invariant này tuyệt đối.
- Board columns staff = `assigned/in_progress/internal_review/changes_requested/delivered` (bỏ New/Confirmed — đó là intake của admin).

## Component reuse map (Admin/shared → Staff)
Không tạo primitive mới. Tái dùng:

| Nhu cầu staff | Component dùng lại |
|---|---|
| Layout | `StaffShell` (đã mirror `AdminShell`) |
| Header trang | `shared/PageHeader` |
| Badge trạng thái/ưu tiên | `shared/StatBadge` (`StatusBadge`, `PriorityBadge`) |
| Bảng (Deliverables, lists) | `shared/DataTable` |
| KPI tile | `shared/KpiTile` |
| Chat 2 luồng (khách/nội bộ) | `shared/MessageThread` |
| Panel trượt chi tiết | `shared/SlideOver` (Esc + focus-trap sẵn) |
| Chip SLA, empty state | `staff/SlaChip`, `staff/EmptyState`/`StaffStates` |

## Proposed UI — per page (target chi tiết)

### 1. My Day (`/staff`) — ✅ giữ, polish nhẹ
Focus list (soonest-due → priority) + 4 KPI (My load, Overdue, Due today, Needs rework). **Thêm:** dải "Recent activity" (deliverable mới duyệt / changes requested) đọc từ `STAFF_NOTIFICATIONS`; link nhanh tới task đang changes_requested.

### 2. My Tasks (`/staff/tasks`) — kanban, parity power-ups
Giữ 5-cột board. **Đưa lên ngang admin tickets/orders:**
- Toggle **Board ↔ List** (List dùng `DataTable`: code, service/pkg, customer, SLA, status, priority).
- Filter chip theo status + search (URL-state, shareable — như audit/tickets admin).
- Card: thêm rework-round badge (`reworkCount`) khi >0.

### 3. Task Detail (`/staff/tasks/[id]`) — **workspace lõi, ưu tiên cao nhất**
Master-detail như `OrderDetailPanel` (406 dòng) của admin nhưng **money-free**. Layout 2 cột:
- **Trái (việc):** header (code, service·pkg, SLA chip, status, prev/next ‹ › + j/k, copy-link — đã có khung); brief (site, keywords, note); QA criteria checklist (`qa`); `DeliverableSubmit` (nộp version mới) + lịch sử version (`deliverablesFor`, diff trạng thái).
- **Phải (giao tiếp):** `MessageThread` 2 tab — **Customer** (khách thấy) và **Internal** (chỉ team). Action: advance status (assigned→in_progress→internal_review→delivered) theo typed state machine; "Request review" / "Mark delivered".
- **Tuyệt đối không** render giá/credit/customer balance.

### 4. Deliverables (`/staff/deliverables`) — ✅ giữ, dùng DataTable
Bảng `myDeliverables()` newest-first: task code, service, version, status, submittedAt. **Thêm:** filter theo status (changes_requested/delivered/approved) + click row mở `SlideOver` xem chi tiết version thay vì nhảy trang.

### 5. Calendar (`/staff/calendar`) — ⚠️ **làm sâu** (đang 29 dòng)
Dựng lịch deadline thật: month-grid hoặc week-list các task theo `deadline`, màu theo SLA (`SlaChip` tone), click ô → task detail. Tái dùng `DeadlineCalendar` component đã có (`components/staff/DeadlineCalendar.tsx`, 4.6KB) nếu chưa wire đủ.

### 6. Performance (`/staff/performance`) — ✅ giữ
Scorecard **cá nhân** (on-time %, rework rate, throughput, sparkline). Chỉ số của chính mình; **ẩn lương/cost/commission** (đã đúng). Đảm bảo không lộ peer pay.

### 7. Notifications (`/staff/notifications`) — ✅ giữ
Inbox `STAFF_NOTIFICATIONS` theo kind (assignment/changes/reminder/approved), mark-read, click → task. OK.

### 8. Settings (`/staff/settings`) — ✅ giữ
Profile (name/role/email/tz/since), skills, `AvailabilityToggle`. OK. **Ẩn** mọi thứ tiền.

## Acceptance criteria
1. 8 mục nav staff đều render đầy đủ, không trang nào còn là placeholder; Calendar là lịch deadline thật (không phải 29-dòng stub).
2. Task Detail: nộp deliverable (mock), chuyển status hợp lệ, chat 2 luồng tách Customer/Internal, prev/next + deep-link `?...`/`/staff/tasks/[id]` hoạt động.
3. My Tasks: toggle Board/List, filter+search là URL-state (refresh giữ nguyên, link chia sẻ được).
4. **Money-hidden test:** grep toàn `app/staff` + `components/staff` không có `price|credit|balance|payout|salary|revenue|margin`; `StaffTask` type vẫn không có field tiền (leak = lỗi tsc).
5. Thị giác đồng bộ admin: cùng shell, badge, table, slide-over; dark mode OK.
6. Mọi list có empty state (`StaffStates`/`EmptyState`).

## Out of scope
- Backend/auth/RLS thật — `CURRENT_STAFF` vẫn là mock cho tới khi auth lands ([[phase0-full-frontend-on-mock]]).
- Realtime messages (polling/mock; D14).
- Manager role UI — spec riêng ([[manager-role-ui]]).
- Mobile-native; chỉ responsive web.

## Files reference
| File | Change |
|---|---|
| `app/staff/tasks/[id]/TaskDetailClient.tsx` | Hoàn thiện workspace 2-cột (verify depth hiện tại trước) |
| `app/staff/calendar/page.tsx` | Làm sâu thành lịch deadline (wire `DeadlineCalendar`) |
| `app/staff/tasks/page.tsx` | Thêm Board/List toggle + filter URL-state |
| `app/staff/deliverables/page.tsx` | DataTable + SlideOver chi tiết |
| `app/staff/page.tsx` | Thêm Recent activity strip |
| `data/staffMock.ts` | Giữ invariant money-free; bổ sung field nếu thiếu cho Calendar |

## Build order (ưu tiên)
1. **P1 — Task Detail** (workspace lõi, verify + hoàn thiện `TaskDetailClient`).
2. **P1 — Calendar** (đang thin nhất).
3. **P2 — My Tasks** Board/List + filter URL-state.
4. **P2 — Deliverables** DataTable + SlideOver.
5. **P3 — My Day** Recent activity strip.
6. **P3 — money-hidden test** (grep + type guard) chốt invariant.
