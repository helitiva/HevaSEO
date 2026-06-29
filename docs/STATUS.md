# STATUS.md — Bảng điều phối backend HevaSEO

> **Cập nhật:** 2026-06-28 · **Nguồn:** [ORCHESTRATION.md](ORCHESTRATION.md) (lane) + [ADR-backend.md](ADR-backend.md) §5 (phase).
> Đây là **single source of truth** cho fleet: slice nào ở đâu, ai làm, kẹt gì. Orchestrator + mỗi agent cập nhật hàng của mình.

**Trạng thái:** ⬜ chưa bắt đầu · 🟡 đang làm · 🔵 PR mở (chờ gác) · ✅ merged · 🔴 kẹt (xem Blocked-on)
**Gác (human):** ① chọn option · ② duyệt cổng · ③ liếc bảo mật · — không cần

---

## FOUNDATION — tuần tự (chặn fleet tới khi `pnpm verify:db` xanh)

| Epic | Slice | Trạng thái | Owner | Gác | Blocked-on / Ghi chú |
|---|---|---|---|---|---|
| **E0a** | Supabase CLI + migration pipeline + pgTAP loop | ✅ | claude | ② | **DONE 2026-06-29**: `verify:db` xanh (pgTAP 3/3). PG17 (khớp managed, lệch plan cũ "15"). uncommitted. |
| **E0a+** | PoC: Auth-hook custom claim + RLS-on-view giữ index | ⬜ | — | ②③ | Fail → cân lại C1 (managed→self-host) |
| **E0b** | Schema lõi (≈25-30 bảng + tenant_id + enum + 3 ledger + docs + broadcasts) | 🟡 | claude | ①③ | **NON-MONEY DONE** (inc-1→7, 107 test xanh, **23 bảng**): + audit_log, notifications, assignment_rules, leave_requests, staff_details. Batch-3 subagent: review sạch, 0 bug. ⚠️ staff/manager order RLS vẫn = gác (K9). **Còn lại = MONEY CLUSTER (gác③ — dừng xin human liếc):** balances+ledger ×3, payroll, affiliate payout, money-stripped views, 7 test CRITICAL. |
| **E0c** | RLS role+tenant + money-stripped views + docs array-RLS | ⬜ | — | ③ | Chờ E0b, E0a+. **7 test CRITICAL** |
| **E0d** | DB functions (create/advance/cancel/topup) + ledger pattern ×3 | ⬜ | — | ③ | Chờ E0b. Atomic + audit |

**Cổng mở fleet:** `pnpm verify:db` xanh + 7 test CRITICAL xanh + human duyệt schema/RLS. 🟡 đang tiến.

**Money cluster (gác③, human duyệt từng increment):**
- ✅ **inc-1 customer_credit** DONE (human duyệt 2026-06-29): `customer_balances` + `credit_ledger`, money-blind (staff=0, manager=0), Stripe idempotency. 3 test CRITICAL xanh.
- ✅ **inc-2 staff_wallet** DONE (human duyệt 2026-06-29): staff_wallet + wallet_ledger + payout_methods + payout_requests, money-blind (manager=0, customer=0). 132 test xanh.
- ✅ **inc-3 affiliate** DONE (human duyệt 2026-06-29): affiliates + referrals + commission + ledger + payouts, money-blind (manager/staff=0) + per-affiliate isolation. **3 hệ tiền XONG.** 146 test xanh.
- 🟡 inc-4 money-stripped views (`orders_mgr` — Finding 1) đang build
- ⬜ E0d ledger functions (create_order/topup/advance atomic)

---

## FLEET — song song sau foundation (tối đa 3-4 worktree)

| Lane | Slice | Worktree | Trạng thái | Owner | Gác | Phụ thuộc |
|---|---|---|---|---|---|---|
| **A** | Orders: auth magic link + **viết lại tầng đọc (orders)** + 1 vòng đơn e2e + wire money-stripped view | `wt-orders` | ⬜ | — | ② | E0d, E0c |
| **B** | customer_credit ledger UI + quick checkout (6 chốt) + Stripe | `wt-credit` | ⬜ | — | ②③ | E0d, A (1 phần) |
| **C** | Docs array-RLS + Broadcasts event log + analytics aggregation | `wt-content` | ⬜ | — | ② | E0c |
| **D** | staff_wallet + payroll (base/gig/commission/bonus−penalty, overrides, presets) | `wt-payroll` | ⬜ | — | ②③ | E0d |
| **E** | affiliate commission/payout + impersonation act-as | `wt-affiliate` | ⬜ | — | ②③ | E0d, E0a+ |

**Thứ tự:** A trước → merge → B/C/D song song → E cuối (nhạy cảm nhất).

---

## Tích hợp (1 coordinator độc quyền)

| Việc | Quy tắc |
|---|---|
| Migration | append-only, serialize qua 1 cửa (tránh đụng timestamp) |
| Types | `supabase gen types` sinh lại sau **mỗi** merge |
| Lane vỡ lúc tích hợp | **quarantine-and-revert**, không patch tại chỗ |
| Sau mỗi merge | chạy lại `pnpm verify:db` trên nhánh tích hợp |

---

## Stop-conditions đang mở (agent dừng, chờ người)

_(trống — chưa chạy)_

| Slice | Vấn đề | Cần gì từ người | Từ khi |
|---|---|---|---|
| — | — | — | — |

---

## Nhật ký gác (human đã quyết gì)

| Ngày | Slice | Kiểu gác | Quyết định |
|---|---|---|---|
| 2026-06-28 | (plan) | — | ADR + ORCHESTRATION + CONTRACTS + STATUS dựng xong; chưa khởi động build |

---

## Cách dùng (cho agent)
1. Trước khi bắt đầu slice: đổi hàng của mình sang 🟡, điền Owner.
2. Đụng stop-condition: đổi 🔴, thêm dòng vào "Stop-conditions đang mở".
3. PR xanh: đổi 🔵. Orchestrator gác → ✅ khi merge.
4. **Không** mở lane mới khi cổng fleet chưa ✅.
