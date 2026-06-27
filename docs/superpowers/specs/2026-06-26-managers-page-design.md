# Spec — Managers Page (Admin module 7b)

**Date:** 2026-06-26
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Related to:** [Staff Management & Performance (module 7)](2026-06-24-staff-performance-design.md).
**Audience:** Master admin.

A dedicated directory of team leads at `/admin/managers` (nav under PEOPLE, after Staff). Distinct from the Manager *role* UI (a restricted admin view) — this page is how the master admin **manages the managers**: sees team composition, edits staff assignments, approves leave, and spots team imbalances.

---

## 1. Scope

**In scope**
- Manager directory with KPI strip and per-manager cards.
- **Editable staff ↔ manager assignment** (inline select + drag-and-drop chips).
- Leave request approvals per manager team.
- Skill-coverage gap detection per team.
- URL deep-linking to a manager's panel.

**Out of scope (future)**
- Add/edit/deactivate manager accounts (built via Settings or a separate flow).
- Org-structure beyond 1 level of management.
- Manager comparison/leaderboard, OKR tracking, 1:1 notes, hiring requests.
- Manager-scoped permissions (what a manager-role admin can see).

---

## 2. Information architecture

```
/admin/managers
├── KPI strip (6 tiles)
├── Unmanaged staff banner (if any) — drag-target + inline "Assign to" dropdown
├── Search + sort toolbar
└── Manager directory grid
    └── ManagerCard × N
        ├── Manager header (avatar · name · title · email)
        ├── Team chips (draggable staff, grip handle, utilization color)
        ├── Utilization bar (avg team load/capacity)
        ├── Quick stats (headcount · avg composite · overloaded · pending leave)
        └── "View team" → opens ManagerPanel SlideOver
```

---

## 3. KPI strip

Six tiles computed from the live assignment state:

| Tile | Metric |
|------|--------|
| Managers | Count of active managers |
| Staff managed | Total staff with a manager assigned |
| Avg team size | Staff managed ÷ managers |
| Team utilisation | Avg `active / capacity` across all managed staff |
| Avg quality | Mean composite score across all managed staff |
| Pending leave | Leave requests awaiting approval |
| Overloaded | Staff where `active ≥ capacity` |

---

## 4. Unmanaged staff banner

If any staff member has no manager assigned, a dismissible warning bar appears at the top of
the directory. It acts as a **drop target** for dragging chips from any manager card ("drop here
to unassign"), and includes an inline "Assign to manager" select per unmanaged member.

---

## 5. Manager card

Each card in the directory grid shows:
- Header: manager avatar (initials), name, title.
- **Team chips**: one chip per staff member, showing name + utilization dot (green/amber/red).
  - Chips are **draggable** (HTML5 DnD, `draggable` + grip handle icon).
  - Dragging a chip highlights the target card's drop zone; dropping calls `assign(staffId, targetManagerId)`.
- **Utilization bar**: visual `avg(active/capacity)` for the team.
- Quick stats row: headcount · avg composite · overloaded count · pending leave count.
- "View team →" button opens the ManagerPanel SlideOver.

---

## 6. Drag-and-drop staff assignment

The DnD mechanism uses the **HTML5 native Drag and Drop API** (no library dependency):

- `draggable` on each staff chip; `onDragStart` stores `staffId + sourceManagerId` in
  `dataTransfer` and a `dragId` state.
- `onDragOver` (with `e.preventDefault()`) + `onDragEnter`/`onDragLeave` on manager cards
  set `overTarget` state for highlight.
- `onDrop` on a card or the unmanaged banner calls `assign(staffId, targetManagerId)`.
- A guard prevents visual highlight when dragging to the staff member's current manager.
- `assignment: Record<staffId, managerId | null>` in client state (initialised from server
  props); `derive()` recomputes all team metrics on every change.

---

## 7. Manager panel (SlideOver)

Opening a manager card shows a detail panel (`max-w-2xl`) with:

- **Quick stats strip**: headcount, avg utilization, avg composite, overloaded count, pending leave.
- **Skill coverage**: lists all skills present in the team; highlights gaps in amber if a needed
  skill (from current active orders for this team) is missing.
- **Leave approval queue**: pending leave requests from this manager's team with Approve / Decline
  buttons (optimistic update, live in mock).
- **Team roster**: each staff member shown with load bar, composite score, active/capacity,
  skills chips, and a "Move to" select for reassignment. An "Add staff" picker lets the admin
  pull any unmanaged (or re-assign from another manager) staff member into this team.
- **"Manage team in Staff →"** link deep-links to `/admin/staff?manager={id}` (honored by
  `StaffClient`).

---

## 8. Search, sort, and URL deep-linking

- **Search** matches manager names and — uniquely — **staff names** (searching "Aria" surfaces
  Sofia Marin's card because Aria is on her team).
- **Sort**: by name · team size · avg utilisation · avg quality.
- **URL deep-link**: `?m=mgr1` opens the ManagerPanel for that manager on page load;
  `window.history.replaceState` keeps the URL in sync as panels open/close.

---

## 9. Data model (mock phase)

Defined in `apps/app/src/data/adminMock.ts`:

```ts
interface AdminManager { id: string; name: string; email: string; title: string; }
const MANAGERS: AdminManager[] = [
  { id: 'mgr1', name: 'Sofia Marin', email: 'sofia@hevaseo.com', title: 'Operations Manager' },
  { id: 'mgr2', name: 'Ken Rivera',  email: 'ken@hevaseo.com',   title: 'Delivery Manager' },
];
const STAFF_MANAGER: Record<string, string> = {
  s1: 'mgr1', s2: 'mgr1', s5: 'mgr1',   // Sofia's team
  s3: 'mgr2', s4: 'mgr2', s6: 'mgr2',   // Ken's team
};
const managerOf = (staffId: string): AdminManager | null => ...
```

The server component (`page.tsx`) computes workload metrics per staff (active orders, overdue,
due-soon, value-in-flight) and passes them alongside the initial assignment map to the client.
The client owns the live `assignment` state and re-derives all team metrics on each change.

---

## 10. Files

| File | Role |
|------|------|
| `apps/app/src/app/admin/managers/page.tsx` | Server component — builds `StaffMemberVM[]`, `ManagerMeta[]`, `TeamLeaveVM[]` |
| `apps/app/src/app/admin/managers/ManagersClient.tsx` | Client component — all interactive logic (KPI strip, cards, DnD, panel, search, sort) |
| `apps/app/src/data/adminMock.ts` | `MANAGERS`, `STAFF_MANAGER`, `LEAVE_REQUESTS`, `managerOf()` |
| `apps/app/src/data/adminNav.ts` | Managers nav entry under PEOPLE section |

---

## 11. Not yet built (deferred)

- **Add / edit / deactivate manager** accounts.
- **Org-structure beyond 1 level** (managers of managers).
- **Manager comparison / leaderboard** across multiple managers.
- **Team OKRs / goals** and per-period target tracking.
- **1:1 notes & escalation log** per manager.
- **Capacity-change and hiring-request approvals** routed through a manager.
- **Per-manager activity feed / audit trail**.
- **SLA-risk oversight** (orders in a manager's team approaching SLA breach).
- **Team announcements** from manager to their team.
- **Manager-scoped permissions** (what a manager-role admin can/cannot see).
