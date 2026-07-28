# ORCHESTRATION.md — Plan điều phối fleet AI-agent build backend

> **Ngày:** 2026-06-28 · **Trạng thái:** Plan, chưa chạy
> **Cơ chế đã chọn:** epic-decompose + fleet worktree · **Mức tự chủ:** gác ở ranh giới slice
> **Nguồn:** [ADR-backend.md](ADR-backend.md) §5 (lộ trình) + eng-review lanes (§9).

---

## 0. Mô hình (đọc trước)

Phối hợp **phân cấp**, không ngang hàng. Worker KHÔNG chat với nhau — phối hợp qua artifact chung (contract + git + verify gate).

```
        ORCHESTRATOR (lead: decompose · assign · integrate · gác cổng)
        │  giao slice qua: plan + DATA-MODEL/CONTRACTS + git + verify gate
        ├─ dev-agent (worktree)  →  1 slice  →  PR khi gate xanh
        ├─ dev-agent (worktree)  →  1 slice  →  PR khi gate xanh
        └─ dev-agent (worktree)  →  1 slice  →  PR khi gate xanh
   Trọng tài = `pnpm verify:db` + build + test CRITICAL. Done = gate xanh, không phải "agent nói xong".
```

---

## 1. Ràng buộc cứng: NỀN MÓNG TRƯỚC, FLEET SAU

Backend đang ở số 0 (chưa `supabase/`, chưa migration, chưa pgTAP). Mọi dev-agent gate trên `pnpm verify:db` — **lệnh đó chưa tồn tại**. Vì vậy:

- **Giai đoạn FOUNDATION (tuần tự, 1 agent, KHÔNG fan-out):** dựng chất nền dùng chung. Cho tới khi `pnpm verify:db` xanh, fleet bị chặn.
- **Giai đoạn FLEET (song song, nhiều worktree):** chỉ mở sau khi foundation xanh.

Đây là single point of dependency — không thể song song hoá.

---

## 2. Decompose: epic → lane → task

### FOUNDATION — tuần tự (E0*) · gác: review từng epic

| Epic | Nội dung | DoD | Phụ thuộc |
|---|---|---|---|
| **E0a** | Supabase CLI + migration pipeline + pgTAP loop `pnpm verify:db` | `db:start && verify:db` xanh trên DB mới migrate | — |
| **E0a+** | PoC bảo mật trên managed: custom-access-token Auth hook bơm `acting_as_id`/`read_only`; RLS đọc custom claim; RLS-on-view giữ index | hook + RLS-on-view chạy đúng; fail → cân lại C1 | E0a |
| **E0b** | Schema lõi (mọi bảng + `tenant_id` + enum `order_state` + `allowed_transitions` + 3 ledger + docs + broadcasts); index RLS; partition schema-ready | migration apply sạch; pgTAP cấu trúc xanh | E0a |
| **E0c** | RLS theo role+tenant + **money-stripped views** (`orders_mgr`…); docs array-RLS | pgTAP RLS theo role+tenant xanh; cross-tenant = 0 dòng; manager-view không cột tiền | E0b, E0a+ |
| **E0d** | DB functions `SECURITY DEFINER`: `create_order`(balance O(1)), `advance_order`, `cancel_order`, `topup`; **ledger pattern dùng chung ×3** | pgTAP: atomic, idempotent, audit đúng, balance==SUM | E0b |

> 7 test CRITICAL (xem ADR §9) phải xanh trong E0c/E0d trước khi mở fleet.

### FLEET — song song sau foundation · gác: ranh giới slice (merge)

| Lane | Slice | Worktree | Phụ thuộc | Lưu ý gác |
|---|---|---|---|---|
| **A** | Orders: auth magic link + **viết lại tầng đọc mock→thật (orders)** + 1 vòng đơn e2e + money-stripped view wiring | `wt-orders` | E0d, E0c | tâm điểm; W1 nằm ở đây |
| **B** | customer_credit ledger UI + quick checkout (6 chốt) + Stripe | `wt-credit` | E0d, A (1 phần) | **money — liếc RLS + idempotency** |
| **C** | Docs array-RLS + Broadcasts event log + analytics aggregation | `wt-content` | E0c | độc lập A/B |
| **D** | staff_wallet + payroll (base/gig/commission/bonus−penalty, overrides, presets) | `wt-payroll` | E0d | **money — liếc RLS** |
| **E** | affiliate commission/payout + **impersonation act-as** | `wt-affiliate` | E0d, E0a+ | **bảo mật cao — review kỹ act-as + audit** |

**Thứ tự chạy:** A trước (mở khoá pattern đọc thật + view). Sau khi A merge → B, C, D song song. E cuối (phụ thuộc Auth hook + nhạy cảm nhất).

```
FOUNDATION:  E0a → E0a+ → E0b → E0c → E0d   (tuần tự)
                                       │  verify:db xanh → mở fleet
FLEET:                    ┌─ Lane A (Orders) ─┐ merge
                          │                   ├─→ Lane B (Credit)  ─┐
                          │                   ├─→ Lane C (Content) ─┼→ merge → Lane E (Affiliate+Impersonation)
                          │                   └─→ Lane D (Payroll) ─┘
```

---

## 3. Hợp đồng vận hành mỗi dev-agent

Mỗi agent nhận đúng **1 slice**, trong **1 worktree cô lập**, chạy vòng:

1. **Plan** slice từ ADR + DATA-MODEL (không tự mở rộng scope).
2. **RED** — viết pgTAP/integration test trước (gồm test CRITICAL của slice).
3. **GREEN** — migration/impl tối thiểu cho test pass.
4. **Self-review** — DRY, error handling, không phá contract.
5. **Commit** chỉ khi `pnpm verify:db` + `pnpm --filter @heva/app build` xanh.
6. **Mở PR**, dừng — chờ orchestrator/human gác.

**Definition of Done (1 slice):** verify:db xanh · build xanh · test CRITICAL của slice xanh · kiểu trả về khớp DATA-MODEL · PR mở.

**Stop-conditions (dừng, hỏi — KHÔNG tự chế):** phải đổi contract · cần secret mới · RLS không diễn đạt được rule · phải bật mục đã hoãn (C1–C6) · test CRITICAL không xanh sau 3 lần thử.

---

## 4. Tích hợp & nơi human gác

- **Human gác ở ranh giới slice:** review khi PR slice xanh + lúc merge. Không soi từng dòng.
- **Slice money/bảo mật (B, D, E):** human **liếc RLS policy + act-as + idempotency** thủ công — đây là đất leo-thang-quyền, gate test chưa đủ.
- **Orchestrator integrate:** merge theo thứ tự lane (§2), chạy lại `verify:db` trên nhánh tích hợp sau mỗi merge; conflict 2 lane chạm cùng module → tuần tự hoá.
- **Foundation (E0*):** review từng epic (không phải mỗi commit) vì là chất nền chung.

---

## 5. Guardrail (an toàn + chi phí)

- **Không fan-out trước khi `verify:db` xanh.** Foundation là cổng.
- **Worktree cô lập** mỗi slice → không giẫm chân; merge có chủ đích, không `git add -A`.
- **Token:** fleet nền tốn nhanh — mở tối đa 3–4 worktree song song, không hơn.
- **Slice nhạy cảm không thả full-auto** dù đã chọn gác-ranh-giới: B/D/E luôn có human liếc.
- **Mỗi PR một slice**, conventional commits, để review gọn.

---

## 6. Khi nào bấm nút chạy

Plan này **chưa chạy**. Trình tự kích hoạt khi sẵn sàng:
1. Build FOUNDATION tuần tự (1 agent hoặc tự tay) tới khi `pnpm verify:db` xanh.
2. `epic-decompose` ADR §5 thành epic/task issue (nếu dùng cơ chế epic GitHub).
3. Mở fleet: mỗi lane 1 dev-agent worktree (`Agent` tool `isolation:"worktree"`, `run_in_background:true`), chạy hợp đồng §3.
4. Human gác theo §4; orchestrator integrate.

---

## 7. Tài liệu liên quan
- [ADR-backend.md](ADR-backend.md) — quyết định kiến trúc + lộ trình + review report (nguồn của decompose).
- [DATA-MODEL.md](DATA-MODEL.md) — contract field/enum/FK mỗi bảng.
- [FEATURES.md](FEATURES.md) — bề mặt tính năng phải phủ.
- [superpowers/plans/2026-06-16-phase0a-db-foundation.md](superpowers/plans/2026-06-16-phase0a-db-foundation.md) — plan chi tiết E0a (đã có).
