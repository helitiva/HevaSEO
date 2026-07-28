# HevaSEO Platform — Developer Onboarding Guide

> Last updated: 2026-07-01. Source of truth for getting oriented and contributing.
> 📘 Backend build history → [BACKEND-BUILD-LOG.md](BACKEND-BUILD-LOG.md) · 🔍 Reviewing the project → [REVIEW-GUIDE.md](REVIEW-GUIDE.md).

---

## Table of Contents

1. [What this is](#1-what-this-is)
2. [Monorepo layout](#2-monorepo-layout)
3. [Running the project](#3-running-the-project)
4. [The 5 role surfaces](#4-the-5-role-surfaces)
5. [Role & RBAC model](#5-role--rbac-model)
6. [Data layer](#6-data-layer)
7. [Conventions](#7-conventions)
8. [How to add a new page](#8-how-to-add-a-new-page)
9. [Known gaps / tech debt](#9-known-gaps--tech-debt)
10. [Where to go deeper](#10-where-to-go-deeper)

---

## 1. What this is

HevaSEO is a **managed SEO service coordination platform** targeting the US market. The business model: customers buy SEO packages → admin receives and assigns them → staff executes → admin approves deliverables → customer signs off.

The repo hosts two apps and a shared design package:

- **`apps/web`** — the Astro marketing site at `hevaseo.com` (static, SEO-optimised, ~0 JS shipped).
- **`apps/app`** — the Next.js SaaS dashboard at `app.hevaseo.com`, the main focus of active development.
- **`packages/ui`** — shared design tokens (Tailwind preset + CSS variables). Both apps consume this so colours, fonts, and radius stay identical.

### Phase-0 mock philosophy

**All UI is built on mock data first. There is no backend yet.**

Every page fetches from in-memory TypeScript constants and localStorage-backed stores under `apps/app/src/data/` and `apps/app/src/lib/`. The design rule is "build the complete UI surface now; wire real data later on request." This means:

- No auth. Any browser can open any URL. **Routes are not protected in Phase 0.**
- Identity is simulated: each role surface renders a hard-coded persona constant (`ADMIN_PERSONA`, `MANAGER_PERSONA`, `CURRENT_STAFF`, `DEFAULT_AFFILIATE_ID`).
- Admin/manager can switch the "active identity" they view via browser cookies — that is the extent of Phase-0 "login".
- When real auth (Supabase + middleware) lands, only the *source* of the `role` variable changes. All `can()` / `filterNav()` / `canAccessPath()` calls remain the same.

---

## 2. Monorepo layout

```
hevaseo-platform/          ← pnpm workspace root
├─ apps/
│  ├─ app/                 ← @heva/app  (Next.js 15, port 4400)  ← main dev target
│  └─ web/                 ← @heva/web  (Astro, marketing site)
├─ packages/
│  ├─ ui/                  ← @heva/ui   (Tailwind preset + tokens.css)
│  └─ catalog/             ← @heva/catalog  (shared upsell/service catalog)
├─ docs/
│  ├─ rbac.md              ← RBAC narrative doc (the source is lib/rbac.ts)
│  ├─ audit/               ← page-crawler audit: INDEX.md + per-surface detail
│  └─ superpowers/specs/   ← deeper feature design specs (22 files)
├─ scripts/                ← maintenance / codegen helpers
├─ master-plan.md          ← product roadmap + data model + tech stack decisions
├─ pnpm-workspace.yaml
└─ package.json            ← root scripts proxy to @heva/web
```

### `apps/app/src` layout

```
src/
├─ app/                    ← Next.js App Router pages
│  ├─ (portal)/            ← customer portal route group
│  │  ├─ layout.tsx        ← wraps PortalShell + context providers
│  │  ├─ dashboard/
│  │  ├─ orders/
│  │  ├─ projects/
│  │  ├─ services/
│  │  ├─ credit/
│  │  ├─ docs/
│  │  ├─ notes/
│  │  ├─ inbox/
│  │  ├─ support/
│  │  └─ settings/
│  ├─ admin/               ← admin area (28 routes)
│  │  ├─ layout.tsx        ← wraps AdminShell
│  │  ├─ page.tsx          ← Command Center overview
│  │  ├─ orders/
│  │  ├─ assignment/
│  │  ├─ review/
│  │  ├─ customers/
│  │  ├─ staff/
│  │  ├─ managers/
│  │  ├─ finance/
│  │  ├─ analytics/
│  │  ├─ catalog/
│  │  ├─ affiliate/
│  │  ├─ broadcasts/
│  │  ├─ docs/
│  │  ├─ notes/
│  │  ├─ tickets/
│  │  ├─ audit/
│  │  └─ settings/
│  ├─ manager/             ← manager area (20 routes, pod-scoped)
│  │  ├─ layout.tsx        ← wraps ManagerShell (sets ViewerProvider role="manager")
│  │  └─ ...mirrors admin minus Finance/Analytics/Managers/Settings
│  ├─ staff/               ← staff area (17 routes)
│  │  ├─ layout.tsx        ← wraps StaffShell
│  │  ├─ tasks/
│  │  ├─ calendar/
│  │  ├─ deliverables/
│  │  ├─ finance/
│  │  ├─ performance/
│  │  ├─ docs/
│  │  ├─ notes/
│  │  ├─ inbox/
│  │  ├─ notifications/
│  │  └─ settings/
│  └─ affiliate/           ← affiliate (KOL) area (7 routes)
│     ├─ join/             ← public landing page (no shell)
│     └─ (dash)/           ← private dash layout wraps AffiliateShell
│        ├─ referrals/
│        ├─ payouts/
│        ├─ assets/
│        ├─ inbox/
│        └─ settings/
├─ components/             ← UI components organised by surface
│  ├─ admin/
│  ├─ manager/
│  ├─ staff/
│  ├─ affiliate/
│  ├─ broadcast/
│  ├─ shared/
│  ├─ docs/
│  ├─ PortalShell.tsx      ← customer portal shell
│  ├─ Sidebar.tsx          ← customer sidebar
│  ├─ Topbar.tsx           ← customer topbar
│  └─ ...misc shared components
├─ data/                   ← mock data (Phase-0 source of truth)
│  ├─ adminMock.ts         ← master dataset: orders, staff, customers, etc.
│  ├─ mock.ts              ← customer-portal mock
│  ├─ staffMock.ts         ← staff-surface derived data (money-free types)
│  ├─ adminNav.ts          ← admin sidebar nav definition
│  ├─ staffNav.ts          ← staff sidebar nav
│  ├─ managerNav.ts        ← manager sidebar nav
│  ├─ nav.ts               ← customer portal nav
│  ├─ affiliateNav.ts
│  ├─ broadcasts.ts        ← broadcast message definitions
│  ├─ broadcastStore.ts    ← localStorage-backed broadcast read-state
│  ├─ docsStore.ts         ← localStorage-backed docs distribution
│  ├─ notesStore.ts        ← localStorage-backed private notes
│  └─ services.ts          ← service catalog (also via @heva/catalog)
└─ lib/                    ← business logic + helpers
   ├─ rbac.ts              ← SINGLE SOURCE: roles, capabilities, matrix, helpers
   ├─ rbac.test.ts         ← matrix lock test
   ├─ rbac.nav.test.ts     ← nav↔RBAC drift guard
   ├─ impersonation.ts     ← cookie helpers for all impersonation flavours
   ├─ viewer.tsx           ← ViewerProvider + useMoney / useShowMoney / useImpersonatePolicy
   ├─ managerScope.ts      ← pod-scoping: which staff/customers a manager may see
   ├─ currentStaff.ts      ← server-side: resolve staff identity from cookie
   ├─ currentAffiliate.ts  ← server-side: resolve affiliate identity from cookie
   ├─ staff.ts             ← staff work/performance calculations
   ├─ staffFinance.ts      ← staff wallet / payout logic
   ├─ staffSettings.ts     ← staff profile settings
   ├─ managerPerf.ts       ← manager performance aggregations
   ├─ managerPulse.ts      ← manager overview signals
   ├─ myDay.ts             ← staff "My Day" task view
   ├─ availability.ts      ← staff work-status model
   ├─ affiliate.ts         ← affiliate commission / earnings
   ├─ sanitizeHtml.ts      ← strict HTML allowlist (used before dangerouslySetInnerHTML)
   └─ *.test.ts            ← colocated unit tests (vitest)
```

---

## 3. Running the project

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install

```bash
pnpm install            # run once from the repo root
```

### Dev

```bash
# Start the Next.js app (primary dev target):
cd apps/app
pnpm dev                # Turbopack, http://localhost:4400

# Or start the marketing site:
cd apps/web
pnpm dev                # Astro dev server (default port 4321)
```

The root `package.json` proxies `pnpm dev` / `pnpm build` / `pnpm preview` to `@heva/web`, so those three commands only affect the Astro site. To work on the Next.js app always `cd apps/app` first or use `pnpm --filter @heva/app <script>`.

### App-specific commands (from `apps/app`)

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js 15 dev server with Turbopack on port 4400 |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build on port 4400 |
| `pnpm lint` | ESLint (`next lint`) |
| `pnpm test` | Run vitest test suite once (all `*.test.ts` files) |

### Running tests

```bash
cd apps/app
pnpm test
# or watch mode:
npx vitest
```

Tests live next to the module they test: `src/lib/rbac.test.ts`, `src/lib/staff.test.ts`, etc. Two critical tests to always keep green:

- `src/lib/rbac.test.ts` — locks the RBAC capability matrix (prevents silent permission drift).
- `src/lib/rbac.nav.test.ts` — drift guard: every nav item must be reachable by the area's persona.

---

## 4. The 5 role surfaces

There are five distinct front-end surfaces, each with its own URL prefix, shell component, and nav definition. **In Phase 0 there is no auth wall — all routes are open.**

### 4.1 Customer portal — `/(portal)/`

**URL prefix:** `/dashboard`, `/orders`, `/projects`, `/services`, `/credit`, `/docs`, `/notes`, `/inbox`, `/settings`, `/support`

**Shell:** `components/PortalShell.tsx` — sidebar (`Sidebar.tsx`) + topbar (`Topbar.tsx`) + broadcast providers.

**Layout file:** `app/(portal)/layout.tsx` — wraps `PortalShell` and mounts these context providers:
- `ToastProvider` — in-app toast notifications
- `CreditProvider` — live credit balance (localStorage-backed `CreditStore`)
- `ProjectsProvider` — project list
- `OrdersProvider` — order list + `OrderDetailPanel` slide-in + `QuickOrderPanel`

**Identity:** Any page under `(portal)` renders for the "current customer". In Phase 0 this is a single demo customer defined in `data/mock.ts`. When an admin impersonates a customer (sets the `heva_as_customer` cookie), `PortalShell` reads the cookie and renders that customer's data, displaying an amber impersonation banner.

**Nav definition:** `data/nav.ts` → `NAV` array.

**What customers see:** their own orders, projects, credit/invoices, docs published to them by admin, private notes, support tickets, and inbox (broadcasts from admin).

**What customers do NOT see:** internal notes/threads, staff identities, pricing of individual staff tasks.

### 4.2 Admin area — `/admin`

**URL prefix:** `/admin/*`

**Shell:** `components/admin/AdminShell.tsx` — `AdminSidebar` + `AdminTopbar`.

**Layout file:** `app/admin/layout.tsx` — a one-liner wrapping `AdminShell`. No `ViewerProvider` is set here; shared components default to `role = 'admin'`.

**Identity:** Hardcoded `ADMIN_PERSONA = 'admin'` in `lib/rbac.ts`. To preview the manager persona (filtered sidebar, no Finance/Analytics), temporarily change `ADMIN_PERSONA` to `'manager'` in that file.

**Nav definition:** `data/adminNav.ts` → `ADMIN_NAV` (5 sections: Operate, People, Business, Knowledge, System).

**Key pages:**
- `/admin` — Command Center (live operational snapshot: pipeline, attention items, KPIs, revenue goal)
- `/admin/orders` — order kanban/table
- `/admin/assignment` — drag-and-drop task assignment
- `/admin/review` — deliverable approval
- `/admin/finance` — revenue, payroll, cashflow (admin-only; manager cannot enter)
- `/admin/analytics` — analytics (admin-only)
- `/admin/managers` — manage team leads (admin-only)
- `/admin/affiliate` — KOL affiliate program management (admin-only)
- `/admin/broadcasts` — send/recall messages to all role surfaces

**Impersonation from admin:** buttons in staff/customer hover cards set `heva_as` or `heva_as_customer` cookies and open the target portal in a new tab.

### 4.3 Manager area — `/manager`

**URL prefix:** `/manager/*`

**Shell:** `components/manager/ManagerShell.tsx` — wraps `ViewerProvider role="manager"` around the entire subtree. This is the key difference from the admin shell.

**Layout file:** `app/manager/layout.tsx`.

**Identity:** `MANAGER_PERSONA = 'mgr1'` in `lib/managerScope.ts`. Pod-scoping (which staff/customers this manager sees) is computed by `managerScope(MANAGER_PERSONA)` in every `/manager` page.

**Nav definition:** `data/managerNav.ts`.

**Money-blind:** `ViewerProvider role="manager"` means `useShowMoney()` returns `false` and `useMoney()` returns a redacting dash (`—`) for every shared component in this area. Managers see operational data only — no revenue, no staff pay, no customer credit balances.

**Pod-scoped:** managers only see the staff in their pod and the customers those staff serve. `lib/managerScope.ts` exports `ordersForPod`, `customersForPod`, `ticketsForPod`, `staffInPod`, `auditInPod` — every `/manager` page routes through these functions.

**Staff impersonation from manager:** only `view` mode (read-only + finance hidden). Cannot impersonate customers.

### 4.4 Staff area — `/staff`

**URL prefix:** `/staff/*`

**Shell:** `components/staff/StaffShell.tsx` — wraps `StaffViewOnlyProvider`.

**Layout file:** `app/staff/layout.tsx`.

**Identity (server-side):** `lib/currentStaff.ts` reads the `heva_as` cookie (set by admin/manager impersonation). If the cookie names a valid staff member, all server components in `/staff` render that person's data. Otherwise falls back to `CURRENT_STAFF` from `data/staffMock.ts`.

**View-only mode:** when a manager impersonates a staff member, `heva_as_mode=view` cookie is set. `StaffShell` reads this and passes `viewOnly=true` to `StaffViewOnlyProvider`. Components under `/staff/finance` are gated behind `ViewOnlyGuard` — but see Known Gaps section for view-only holes in other pages.

**Money rule:** `StaffTask` type (in `data/staffMock.ts`) deliberately omits `value`/`price` fields — if code tries to display customer order value for staff, it is a TypeScript compile error, not a runtime check.

**What staff see:** their assigned tasks, calendar, deliverables, their own commission wallet + payout requests (not other staff's), skill-gated docs published by admin, private notes, broadcasts inbox, performance metrics.

### 4.5 Affiliate area — `/affiliate`

**URL prefix:** `/affiliate/join` (public), `/affiliate/*` (private dash under `(dash)` route group)

**Shell:** `components/affiliate/AffiliateShell.tsx` — wraps the private dashboard with `AffiliateSidebar` + `AffiliateTopbar` + broadcast providers. The public `/affiliate/join` page does NOT use this shell.

**Layout file:** `app/affiliate/(dash)/layout.tsx`.

**Identity (client-side):** `AffiliateShell` reads the `heva_as_affiliate` cookie after mount (SSR-safe: starts as the default demo partner). `lib/currentAffiliate.ts` handles server-side resolution for RSC pages.

**Nav definition:** `data/affiliateNav.ts`.

**What affiliates see:** their referral links, tiered commission dashboard, payout requests, marketing assets, broadcasts inbox, settings.

---

## 5. Role & RBAC model

**Single source of truth: `apps/app/src/lib/rbac.ts`**

The narrative explanation is in `docs/rbac.md`. Here is the mechanical summary.

### 5.1 Four roles

| Role | Home path | One-liner |
|---|---|---|
| `admin` | `/admin` | Full access everywhere. |
| `manager` | `/manager` | = admin minus Finance, Analytics, Managers, org Settings. Pod-scoped. |
| `staff` | `/staff` | Own work + knowledge + self-service. Never sees customer prices. |
| `customer` | `/dashboard` | Own portal only. Sees their own pricing/credit. Never sees internal notes. |

### 5.2 Capability matrix

`ROLE_CAPABILITIES` in `rbac.ts` maps each role to an array of named capabilities. Key cross-cutting rules:

- `pricing.view` — staff do NOT have this. Wrap any money display: `{can(role, 'pricing.view') && <Price />}`.
- `notes.internal.view` — customer does NOT have this. Filter message threads before rendering for customers.
- `finance.view` / `analytics.view` — admin only. Routes `/admin/finance` and `/admin/analytics` require these, so managers are blocked even though they have `admin.access`.
- `managers.manage` — admin only. `/admin/managers` requires this.

### 5.3 The three helper functions

```ts
import { can, canAccessPath, filterNav, homePathFor } from '@/lib/rbac';

can(role, 'finance.view')         // boolean — gate individual UI elements
canAccessPath(role, '/admin/finance')  // boolean — gate navigation / URL access
filterNav(ADMIN_NAV, role)        // drop nav items the role cannot reach
homePathFor(role)                 // where to land after login
```

All sidebars call `filterNav` — this is why the admin and manager sidebars look different without any per-sidebar logic.

### 5.4 Route protection

`ROUTE_CAPABILITY` in `rbac.ts` maps URL prefixes to required capabilities, ordered most-specific first. Two umbrella entries at the end:
- `/admin` → `admin.access` (manager has this — be careful!)
- `/staff` → `staff.access`

**The umbrella trap:** any new `/admin/*` page you add without a specific entry in `ROUTE_CAPABILITY` inherits `admin.access`, which managers also hold. If the page contains financial data, you MUST add an explicit entry pointing to `finance.view` or `analytics.view`. The drift guard test (`rbac.nav.test.ts`) catches some of these, but not all — see `docs/rbac.md` section 7 for the full explanation.

### 5.5 ViewerProvider — shared components in admin vs manager

Many heavy components (`CustomerDetailView`, `StaffHoverCard`, etc.) are reused across both `/admin` and `/manager`. They behave differently for a manager:
- No money shown
- Impersonation is view-only
- Deep-links stay within `/manager` instead of bouncing to `/admin`

Rather than threading props through many levels, `ManagerShell` wraps the whole `/manager` tree in `<ViewerProvider role="manager">`. Components call `useShowMoney()`, `useMoney()`, `useImpersonatePolicy()`, and `useAreaBase()` from `lib/viewer.tsx` to adapt.

Default context value is `'admin'`, so every component in `/admin` (which has no explicit provider) behaves as before.

### 5.6 Manager pod-scoping

`lib/managerScope.ts` answers "on whose data" (complement to RBAC's "what action"). `managerScope(managerId)` returns the set of staff, customers, orders, and audit events belonging to a manager's pod. Every `/manager` page calls one of the scoped helpers (`ordersForPod`, `customersForPod`, etc.) rather than querying the full dataset.

---

## 6. Data layer

**Everything is mock in Phase 0. No API calls, no database.**

### 6.1 Static mock constants

`apps/app/src/data/adminMock.ts` is the master dataset:
- `ORDERS` — all service orders (status, deadline, staff, customer, etc.)
- `STAFF` — staff roster
- `CUSTOMERS` — customer accounts
- `MANAGERS` — manager accounts
- `TICKETS`, `DELIVERABLES`, `AUDIT` — support tickets, deliverables, audit log
- `KPIS`, `REVENUE_GOAL`, `PIPELINE` — admin dashboard stats
- `money()` — USD formatter for admin/manager (redacted by `useMoney()` for managers)

Derived mock files pull from `adminMock` and transform data for a specific surface:
- `data/staffMock.ts` — staff-scoped view (no pricing fields at the type level)
- `data/mock.ts` — customer-portal mock
- `data/affiliatePortal.ts`, `data/adminAffiliate.ts` — affiliate data

### 6.2 localStorage-backed stores

Some interactive features persist across page reloads using `localStorage`:

| Store | File | What it persists |
|---|---|---|
| Broadcast read/dismissed state | `data/broadcastStore.ts` | Which broadcasts a user has read or dismissed |
| Notes | `data/notesStore.ts` | Customer & manager private notebook entries |
| Staff notes | `data/staffNotes.ts` | Staff private notebook entries |
| Docs distribution | `data/docsStore.ts` | Which docs admin has distributed to which audiences |
| Orders | `components/OrdersStore.tsx` | Customer order list (React context, initialised from mock) |
| Credit | `components/CreditStore.tsx` | Customer credit balance (React context) |
| Projects | `components/ProjectsStore.tsx` | Customer project list (React context) |

### 6.3 How a page reads data

The standard pattern for a Server Component page:

```tsx
// app/admin/orders/page.tsx
import { ORDERS } from '@/data/adminMock';
import { OrdersClient } from './OrdersClient';

export const metadata = { title: 'Orders' };

export default function OrdersPage() {
  // Transform/filter mock data
  const orders = ORDERS.filter(o => o.status !== 'completed');
  return <OrdersClient orders={orders} />;
}
```

For pages that need impersonation-aware identity resolution, call the server-side helpers before passing to the client:

```tsx
// app/staff/tasks/page.tsx
import { currentStaffId } from '@/lib/currentStaff';
import { buildTasksForStaff } from './build';
import { TasksClient } from './TasksClient';

export default async function TasksPage() {
  const staffId = await currentStaffId();        // reads heva_as cookie
  const tasks = buildTasksForStaff(staffId);    // builder fn in adjacent build.ts
  return <TasksClient tasks={tasks} />;
}
```

Many pages have an adjacent `build.ts` file that contains the pure data transformation logic, keeping `page.tsx` thin and the transformation testable independently.

### 6.4 When real backend lands

Replace each mock data source:
- `data/adminMock.ts` constants → Supabase queries
- `currentStaffId()` → reads staff id from session (cookie set by Supabase Auth middleware)
- localStorage stores → server actions + Supabase tables
- The RBAC matrix and all capability checks remain unchanged; only the source of `role` changes from the hardcoded persona constant to `session.user.role`.

---

## 7. Conventions

### 7.1 File organisation

Feature-folder layout — group by surface/feature, not by type:

```
app/admin/orders/
  page.tsx          ← Server Component; reads data; passes to client
  build.ts          ← pure data builder (testable, no React)
  OrdersClient.tsx  ← "use client"; interactive parts
  NeedsAttention.tsx ← colocated sub-component (could be client or server)
```

Rules:
- `*Client.tsx` suffix for files with `"use client"` at the top.
- `page.tsx` defaults to Server Component (no `"use client"`). Add the directive only when the page itself needs state/effects.
- `build.ts` for data transformation logic that page.tsx imports — keeps page files thin and puts business logic in testable pure functions.
- Max 800 lines per file; extract helpers when approaching that limit.

### 7.2 Page anatomy

A well-formed page:

```tsx
// export metadata for browser tab title
export const metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <>
      {/* Use a PageHeader component for the h1 + action buttons */}
      <div className="flex items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">28 active orders</p>
        </div>
        <button>…</button>
      </div>

      {/* Page content */}
    </>
  );
}
```

- Every page must export `metadata` — staff and manager pages are currently missing these (see Known Gaps).
- Use Phosphor icons (`ph-bold ph-*`) for consistency. Always add `aria-hidden` to decorative icons.

### 7.3 Styling

- **Tailwind** for all layout/spacing/colour.
- Design tokens from `packages/ui/tokens.css` (imported in `globals.css`): `--color-primary`, `--color-background`, `--color-card`, `--color-border`, `--color-muted-foreground`, etc.
- CSS class conventions for complex reusable patterns are in `app/globals.css` and `app/dashboard.css`:
  - `.kpi` — KPI card tile
  - `.pill`, `.pill-live`, `.pill-warn` — status badges
  - `.bar` — progress bar
  - `.page-anim` — route transition
  - `.display` — display-weight font class
- Do not animate layout-bound properties (`width`, `height`, `margin`, `padding`). Prefer `transform` and `opacity`.

### 7.4 TypeScript

- No `any`. Use `unknown` for external/untrusted input and narrow it.
- Named interface/type for all component props.
- Immutable patterns: spread operator for updates, never mutate in place.
- Type-level money-blindness: `StaffTask` in `data/staffMock.ts` has no `value`/`price` fields by design — a compile error if you accidentally leak prices to staff.

### 7.5 Component naming

- **PascalCase** for component files and exports: `AdminSidebar.tsx`, `PortalShell.tsx`.
- **`*Client.tsx`** suffix for any file that has `"use client"` (makes server/client boundary visible in the file tree).
- **`*Shell.tsx`** suffix for the layout shell of each surface.
- Hooks start with `use`: `useViewerRole`, `useShowMoney`, `useMoney`.

### 7.6 Tests

Tests live next to the module they test. Use vitest. Pattern: `src/lib/staff.ts` → `src/lib/staff.test.ts`.

```ts
import { describe, it, expect } from 'vitest';

describe('summariseEarnings', () => {
  it('returns zero totals for an empty array', () => {
    // Arrange
    const earnings: MonthEarning[] = [];
    // Act
    const result = summariseEarnings(earnings);
    // Assert
    expect(result.total).toBe(0);
  });
});
```

Run all tests: `pnpm test` (from `apps/app`).

---

## 8. How to add a new page

This walkthrough adds a hypothetical `/admin/reports` page visible to both admin and manager.

### Step 1 — Create the route folder and files

```
apps/app/src/app/admin/reports/
  page.tsx          ← Server Component
  build.ts          ← data builder
  ReportsClient.tsx ← client component (if needed)
```

### Step 2 — Write the page

```tsx
// app/admin/reports/page.tsx
import type { Metadata } from 'next';
import { buildReports } from './build';
import { ReportsClient } from './ReportsClient';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  const data = buildReports();
  return <ReportsClient data={data} />;
}
```

### Step 3 — Add to nav

Open `data/adminNav.ts` and add an entry to the relevant section:

```ts
{ label: 'Reports', href: '/admin/reports', icon: 'ph-file-text' },
```

The sidebar calls `filterNav(ADMIN_NAV, role)` from `rbac.ts` — if the route is accessible to the current role, the item appears automatically.

### Step 4 — Decide RBAC

- **Admin + manager both see it:** no extra action needed. `/admin/*` requires `admin.access` by default, which both roles have.
- **Admin only (e.g. financial data):** add an entry to `ROUTE_CAPABILITY` in `lib/rbac.ts` before the umbrella entry:
  ```ts
  { prefix: '/admin/reports', capability: 'finance.view' },
  ```
  This blocks managers even though they have `admin.access`.

### Step 5 — Write a data builder (optional but recommended)

```ts
// app/admin/reports/build.ts
import { ORDERS } from '@/data/adminMock';

export interface ReportRow { month: string; count: number; }

export function buildReports(): ReportRow[] {
  // pure transformation — easy to unit test
  return ORDERS.reduce<ReportRow[]>(/* ... */, []);
}
```

### Step 6 — Run the drift guard

```bash
cd apps/app
pnpm test   # rbac.nav.test.ts will catch nav↔RBAC mismatches
```

### Step 7 — Write a test for the builder

```ts
// app/admin/reports/build.test.ts  (or put it in lib/ if it's generic)
import { describe, it, expect } from 'vitest';
import { buildReports } from './build';

describe('buildReports', () => {
  it('returns at least one row', () => {
    expect(buildReports().length).toBeGreaterThan(0);
  });
});
```

### Adding a page under a different surface

Same pattern, different surface-specific details:

| Surface | Layout wraps | Nav file | Builder location |
|---|---|---|---|
| Customer portal | `PortalShell` via `(portal)/layout.tsx` | `data/nav.ts` | `app/(portal)/[page]/build.ts` |
| Manager | `ManagerShell` (includes `ViewerProvider`) | `data/managerNav.ts` | `app/manager/[page]/build.ts` |
| Staff | `StaffShell` | `data/staffNav.ts` | `app/staff/[page]/build.ts` |
| Affiliate | `AffiliateShell` via `(dash)/layout.tsx` | `data/affiliateNav.ts` | `app/affiliate/(dash)/[page]/build.ts` |

For **manager pages**, always scope data through `managerScope()` from `lib/managerScope.ts`, and never display raw money fields — use `useMoney()` from `lib/viewer.tsx` in any client component that needs to format currency.

For **staff pages**, build your data type in `data/staffMock.ts` pattern: exclude pricing fields at the TypeScript level, not just at runtime.

---

## 9. Known gaps / tech debt

From the Phase-1 audit (`docs/audit/INDEX.md`). No CRITICALs, security is clean. Prioritised fix list:

### HIGH

1. **Staff view-only contract broken** — when a manager opens a staff member's portal in `view` mode, `ViewOnlyGuard` only protects `/staff/finance`. Task actions (Start/Submit in `TaskDetailClient`), notes CRUD (`NotesClient`, `NoteFullEditor`), and settings (`SettingsClient`) still allow mutations. Fix: add `useStaffViewOnly()` checks in those clients.

2. **Customer dashboard frozen metrics** — `TODAY = new Date('2026-06-25')` is set at module scope in `DashboardTop.tsx`, freezing the 7/30/90-day filter. The on-time percentage (96/100) and sparklines are static JSX, not computed from data. Needs a proper date anchor and derived calculations.

3. **`localhost:4330` hardcoded** in `SupportClient.tsx` FAQ links — 404 in any non-dev environment.

4. **Customer notebook seeds staff notes** — `notesStore` initialises with `SEED_NOTES` (staff-authored content) on a customer's first visit. Wrong data for the wrong audience.

### MEDIUM (systemic)

- **15+ hardcoded date anchors** scattered across all surfaces (`lib/staff.ts`, `assignment/build.ts`, `review/build.ts`, `affiliate` overview, etc.), several diverging from each other by days. A central "today" constant (or per-request `new Date()`) is needed, or date-dependent SLA/deadline/penalty logic breaks silently.
- **Module-scope singleton data** — `STAFF_NOTIFICATIONS` and `MY_AVAILABILITY` are keyed to the demo persona and frozen at module load. When impersonating a different staff member, these show the wrong person's data. Same issue for affiliate `programStats()` / `joinOffer()` (frozen "paid last month" countdown).
- **`notFound()` missing** on dynamic edit routes — `/admin/docs/[id]/edit`, `/admin/notes/[id]/edit`, and customer/manager equivalents render a blank editor instead of a 404 for unknown IDs.
- **`Suspense fallback={null}`** on admin finance and affiliate pages — causes a blank flash before hydration completes. Replace with skeleton components.

### LOW (systemic)

- **Missing `export const metadata`** — staff (0/17 routes), manager (0/20 routes), admin (1 missing), several customer routes, and affiliate inbox all show the root title in browser tabs.
- **Decorative icons missing `aria-hidden`** — `<i className="ph-bold ph-*">` tags throughout all surfaces without `aria-hidden="true"`, causing screen readers to announce icon class names as text.
- **Bare inbox pages** — affiliate and manager inbox pages render the client component with no surrounding `PageHeader` or metadata export.

### Phase-3 fix priority order

1. Staff view-only guards
2. Customer dashboard: real date anchor, derived metrics, fix support URLs, fix notes seeding
3. Centralise a single "today" source across all surfaces
4. Convert module-scope singleton reads → per-request / persona-aware
5. `notFound()` on edit routes; replace `Suspense fallback={null}` with skeletons
6. Systemic sweeps: `metadata` exports, `aria-hidden` on icons, inbox `PageHeader`s

---

## 10. Where to go deeper

### Design specs (`docs/superpowers/specs/`)

22 feature-level design documents, covering every major surface. Key ones:

| File | Covers |
|---|---|
| `2026-06-14-hevaseo-architecture-plan.md` | Overall architecture + self-hosting plan |
| `2026-06-22-hevaseo-services-catalog.md` | Service catalog design |
| `2026-06-24-admin-dashboard-overview.md` | Command Center spec |
| `2026-06-24-order-management-design.md` | Order lifecycle + state machine |
| `2026-06-24-assignment-routing-design.md` | Task assignment routing |
| `2026-06-24-finance-design.md` | Credit ledger + payroll model |
| `2026-06-24-staff-performance-design.md` | Staff performance metrics |
| `2026-06-26-staff-surface-design.md` + `staff-ui-spec.md` | Staff portal full spec |
| `2026-06-26-managers-page-design.md` | Manager overview command center |
| `2026-06-27-staff-finance-page-design.md` | Staff commission wallet |
| `2026-06-28-kol-affiliate-design.md` | Affiliate (KOL) program |
| `2026-06-24-messaging-notifications-design.md` | Broadcast messaging system |
| `2026-06-24-deliverable-review-design.md` | Review/approval flow |
| `2026-06-24-audit-log-design.md` | Audit log design |

### Audit reports (`docs/audit/`)

- `PLAN.md` — the page-crawler pipeline runbook
- `RUBRIC.md` — scoring rubric used in the audit
- `INDEX.md` — roll-up of all 89 routes (start here)
- `admin.md`, `staff.md`, `manager.md`, `customer.md`, `affiliate.md` — per-surface detail with specific file references and remediation suggestions for every issue

### Core reference files

| File | What to read it for |
|---|---|
| `apps/app/src/lib/rbac.ts` | Every permission decision in the app |
| `docs/rbac.md` | Narrative explanation of the RBAC model |
| `apps/app/src/data/adminMock.ts` | All mock data (start here to understand any dataset) |
| `master-plan.md` | Business model, data model, phase roadmap, tech stack rationale |
| `apps/app/src/lib/impersonation.ts` | Cookie names and helpers for all impersonation flavours |
| `apps/app/src/lib/viewer.tsx` | `ViewerProvider` and all viewer-aware hooks |
| `apps/app/src/lib/managerScope.ts` | Pod-scoping helpers for the manager surface |
