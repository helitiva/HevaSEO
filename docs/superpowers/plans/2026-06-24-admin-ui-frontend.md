# Admin Dashboard — UI-First (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the master-admin dashboard **interface** with mock data, reusing the existing user-dashboard design system, so every screen is visible and reviewable before any backend exists.

**Architecture:** New `/admin` route tree in `apps/app` with its own shell (`AdminShell`) that **reuses the portal's chrome pattern and `dashboard.css` classes** (`.kpi`, `.pill`, `.kcard`, `.prio`, `.nav-item`, `.display`, slide-over). All data comes from a new `src/data/adminMock.ts`. A small shared presentational kit (`PageHeader`, `DataTable`, `StatBadge`, `KpiTile`) keeps screens DRY. No Supabase, no auth, no Server Actions — pure UI.

**Tech Stack:** Next 15 App Router, React 19, Tailwind + `@heva/ui` tokens, Phosphor icons (`ph-bold`/`ph-fill`), existing `dashboard.css`.

**Specs:** [overview](../specs/2026-06-24-admin-dashboard-overview.md) and the per-module design specs (`2026-06-24-*-design.md`). This plan implements their **screens only**; data/actions land later when the backend plan runs.

---

## Conventions

- App package is `@heva/app`; run app commands with `pnpm --filter @heva/app <cmd>`.
- Admin pages live under `apps/app/src/app/admin/...` → URLs `/admin/...` (the portal owns `/(portal)` routes; no collision).
- **Reuse, don't restyle:** use the existing `dashboard.css` classes and `@heva/ui` tokens. Do not fork the portal's `Sidebar`/`Topbar`; create admin siblings that reuse the same classes so the live portal is untouched.
- Every screen is a Server Component reading `adminMock.ts`; interactivity (filters, tabs, slide-overs) is in small client components.
- **Verify each screen in the browser** with the preview tools before committing (no backend needed — mock data renders immediately).
- Icons: verify against the Phosphor set already used in the app before introducing a new one.
- Commit per task.

## File Structure

**Shell & nav**
- `apps/app/src/app/admin/layout.tsx` — wraps pages in `AdminShell`.
- `apps/app/src/components/admin/AdminShell.tsx` — flex shell (sidebar + topbar + main), mirrors `PortalShell`.
- `apps/app/src/components/admin/AdminSidebar.tsx` — admin nav (reuses `.nav-item`).
- `apps/app/src/components/admin/AdminTopbar.tsx` — admin top bar (search + notif + admin avatar).
- `apps/app/src/data/adminNav.ts` — admin nav sections (extends the stub from the backend plan; here it is the source of truth for UI).

**Shared kit**
- `apps/app/src/components/admin/PageHeader.tsx` — title + subtitle + actions slot.
- `apps/app/src/components/admin/DataTable.tsx` — generic columns/rows table (reuses table styling).
- `apps/app/src/components/admin/StatBadge.tsx` — status/priority pills (`.pill`, `.prio`).
- `apps/app/src/components/admin/KpiTile.tsx` — KPI card (`.kpi`).
- `apps/app/src/components/admin/SlideOver.tsx` — right slide-over (reuses `.order-panel`).

**Mock data**
- `apps/app/src/data/adminMock.ts` — orders, customers, staff, tickets, deliverables, ledger, rules, audit, KPIs.

**Screens (one folder per area under `apps/app/src/app/admin/`)**
- `page.tsx` (Command Center) · `orders/` · `customers/` · `staff/` · `assignment/` · `review/` · `tickets/` · `finance/` · `catalog/` · `analytics/` · `audit/` · `settings/`.

---

## Phase 0 — Shell, nav, mock data, shared kit

### Task 1: Admin nav + mock data scaffold

**Files:**
- Create: `apps/app/src/data/adminNav.ts`, `apps/app/src/data/adminMock.ts`

- [ ] **Step 1: Admin nav**

Create `apps/app/src/data/adminNav.ts`:

```ts
export interface AdminNavItem { label: string; href: string; icon: string; }
export interface AdminNavSection { title: string; items: AdminNavItem[]; }

export const ADMIN_NAV: AdminNavSection[] = [
  { title: 'Operate', items: [
    { label: 'Overview', href: '/admin', icon: 'ph-squares-four' },
    { label: 'Orders', href: '/admin/orders', icon: 'ph-kanban' },
    { label: 'Assignment', href: '/admin/assignment', icon: 'ph-flow-arrow' },
    { label: 'Review', href: '/admin/review', icon: 'ph-seal-check' },
    { label: 'Tickets', href: '/admin/tickets', icon: 'ph-lifebuoy' },
  ]},
  { title: 'People', items: [
    { label: 'Customers', href: '/admin/customers', icon: 'ph-users' },
    { label: 'Staff', href: '/admin/staff', icon: 'ph-user-gear' },
  ]},
  { title: 'Business', items: [
    { label: 'Finance', href: '/admin/finance', icon: 'ph-wallet' },
    { label: 'Catalog', href: '/admin/catalog', icon: 'ph-tag' },
    { label: 'Analytics', href: '/admin/analytics', icon: 'ph-chart-line-up' },
  ]},
  { title: 'System', items: [
    { label: 'Audit log', href: '/admin/audit', icon: 'ph-scroll' },
    { label: 'Settings', href: '/admin/settings', icon: 'ph-gear-six' },
  ]},
];
```

- [ ] **Step 2: Mock data**

Create `apps/app/src/data/adminMock.ts`:

```ts
// Mock data for the admin UI. Shapes mirror the design specs; replaced by DB later.
export type OrderStatus = 'new'|'confirmed'|'assigned'|'in_progress'|'internal_review'|'delivered'|'changes_requested'|'approved'|'completed'|'canceled';
export type Priority = 'low'|'med'|'high';

export interface AdminOrder {
  id: string; code: string; customer: string; service: string; pkg: string;
  status: OrderStatus; priority: Priority; source: 'quick'|'dashboard';
  value: number; staff: string | null; deadline: string | null; created: string;
}
export interface AdminCustomer {
  id: string; name: string; company: string; email: string; status: 'shadow'|'claimed';
  orders: number; spend: number; balance: number; lastActive: string;
}
export interface AdminStaff {
  id: string; name: string; skills: string[]; capacity: number; openLoad: number;
  composite: number; quality: number; onTime: number; throughput: number; active: boolean;
}
export interface AdminTicket {
  id: string; subject: string; customer: string; status: 'open'|'pending'|'resolved'|'closed';
  priority: Priority; assignee: string | null; age: string;
}
export interface AdminRule { id: string; service: string; pkg: string | null; mode: 'pin'|'auto'; target: string | null; priority: number; active: boolean; }
export interface AuditEntry { id: string; at: string; actor: string; entity: string; action: string; change: string; }

export const KPIS = {
  newOrders: 6, inProgress: 11, overdue: 3, awaitingApproval: 4,
  revenueToday: 1240, revenueMtd: 18650, openTickets: 5, unassigned: 2,
};

export const ORDERS: AdminOrder[] = [
  { id: 'o1', code: 'AUD-1001', customer: 'Acme Co', service: 'Audit', pkg: 'Standard', status: 'new', priority: 'high', source: 'quick', value: 39, staff: null, deadline: '2026-06-26', created: '2026-06-24' },
  { id: 'o2', code: 'KW-1002', customer: 'Bright Ltd', service: 'Keyword', pkg: 'Standard', status: 'in_progress', priority: 'med', source: 'dashboard', value: 39, staff: 'Mai T.', deadline: '2026-06-25', created: '2026-06-23' },
  { id: 'o3', code: 'BL-1003', customer: 'Nova', service: 'Backlink', pkg: 'Growth', status: 'internal_review', priority: 'high', source: 'dashboard', value: 64, staff: 'Linh P.', deadline: '2026-06-24', created: '2026-06-21' },
  { id: 'o4', code: 'CNT-1004', customer: 'Acme Co', service: 'Content', pkg: '10 articles', status: 'delivered', priority: 'med', source: 'quick', value: 120, staff: 'Huy N.', deadline: '2026-06-27', created: '2026-06-20' },
  { id: 'o5', code: 'OPT-1005', customer: 'Vértice', service: 'Optimization', pkg: 'Standard', status: 'completed', priority: 'low', source: 'dashboard', value: 79, staff: 'Mai T.', deadline: '2026-06-22', created: '2026-06-18' },
];

export const CUSTOMERS: AdminCustomer[] = [
  { id: 'c1', name: 'Jane Doe', company: 'Acme Co', email: 'jane@acme.com', status: 'claimed', orders: 8, spend: 1240, balance: 320, lastActive: '2026-06-24' },
  { id: 'c2', name: 'Sam Lee', company: 'Bright Ltd', email: 'sam@bright.io', status: 'shadow', orders: 2, spend: 198, balance: 0, lastActive: '2026-06-23' },
  { id: 'c3', name: 'Ana Ruiz', company: 'Nova', email: 'ana@nova.co', status: 'claimed', orders: 14, spend: 3180, balance: 540, lastActive: '2026-06-22' },
];

export const STAFF: AdminStaff[] = [
  { id: 's1', name: 'Mai T.', skills: ['keyword','optimize'], capacity: 6, openLoad: 3, composite: 92, quality: 95, onTime: 90, throughput: 22, active: true },
  { id: 's2', name: 'Linh P.', skills: ['backlink'], capacity: 5, openLoad: 4, composite: 88, quality: 86, onTime: 92, throughput: 31, active: true },
  { id: 's3', name: 'Huy N.', skills: ['content'], capacity: 8, openLoad: 5, composite: 84, quality: 88, onTime: 79, throughput: 40, active: true },
];

export const TICKETS: AdminTicket[] = [
  { id: 't1', subject: 'When will my report be ready?', customer: 'Acme Co', status: 'open', priority: 'high', assignee: null, age: '2h' },
  { id: 't2', subject: 'Invoice question', customer: 'Nova', status: 'pending', priority: 'med', assignee: 'Mai T.', age: '1d' },
];

export const RULES: AdminRule[] = [
  { id: 'r1', service: 'Backlink', pkg: null, mode: 'pin', target: 'Linh P.', priority: 10, active: true },
  { id: 'r2', service: 'Content', pkg: null, mode: 'auto', target: null, priority: 50, active: true },
];

export const AUDIT: AuditEntry[] = [
  { id: 'a1', at: '2026-06-24 09:12', actor: 'Admin', entity: 'order', action: 'transition', change: 'AUD-1001 new→confirmed' },
  { id: 'a2', at: '2026-06-24 08:40', actor: 'Admin', entity: 'order', action: 'assign', change: 'KW-1002 → Mai T.' },
];

export const statusLabel: Record<OrderStatus, string> = {
  new:'New', confirmed:'Confirmed', assigned:'Assigned', in_progress:'In progress', internal_review:'Internal review',
  delivered:'Delivered', changes_requested:'Changes requested', approved:'Approved', completed:'Completed', canceled:'Canceled',
};
export const money = (n: number) => `$${n.toLocaleString('en-US')}`;
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/data/adminNav.ts apps/app/src/data/adminMock.ts
git commit -m "feat(admin-ui): admin nav + mock data scaffold"
```

### Task 2: Admin shell (sidebar + topbar + layout)

**Files:**
- Create: `apps/app/src/components/admin/AdminSidebar.tsx`, `AdminTopbar.tsx`, `AdminShell.tsx`
- Create: `apps/app/src/app/admin/layout.tsx`

- [ ] **Step 1: Sidebar** (reuses `.nav-item`, `.display`)

Create `apps/app/src/components/admin/AdminSidebar.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV } from '@/data/adminNav';

export function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
  return (
    <aside className={`fixed inset-y-0 left-0 z-[60] w-64 shrink-0 border-r border-border bg-card transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[68px] items-center gap-2 border-b border-border px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">H</span>
        <span className="display text-lg font-bold">HevaSEO <span className="text-primary">Admin</span></span>
      </div>
      <nav className="space-y-5 p-3">
        {ADMIN_NAV.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((i) => (
                <Link key={i.href} href={i.href} onClick={onClose} className={`nav-item ${isActive(i.href) ? 'active' : ''}`}>
                  <i className={`ph-bold ${i.icon}`} /> {i.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Topbar**

Create `apps/app/src/components/admin/AdminTopbar.tsx`:

```tsx
import { ThemeToggle } from '../ThemeToggle';

export function AdminTopbar({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-7">
      <button onClick={onMenu} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-lg border border-border lg:hidden">
        <i className="ph-bold ph-list text-lg" />
      </button>
      <div className="hidden w-1/3 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:flex">
        <i className="ph-bold ph-magnifying-glass" />
        <input aria-label="Search" className="w-full bg-transparent outline-none" placeholder="Search orders, customers…" />
        <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] font-semibold">⌘K</kbd>
      </div>
      <div className="flex-1" />
      <ThemeToggle />
      <button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent">
        <i className="ph-bold ph-bell text-lg" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
      </button>
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md">AD</span>
    </header>
  );
}
```

- [ ] **Step 3: Shell** (mirrors `PortalShell`)

Create `apps/app/src/components/admin/AdminShell.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar open={open} onClose={() => setOpen(false)} />
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm lg:hidden" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onMenu={() => setOpen(true)} />
        <main className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:pb-6 lg:px-7">
          <div key={pathname} className="page-anim">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Layout**

Create `apps/app/src/app/admin/layout.tsx`:

```tsx
import { AdminShell } from '@/components/admin/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
```

- [ ] **Step 5: Verify (needs a temp page)**

Create a temporary `apps/app/src/app/admin/page.tsx`:

```tsx
export default function AdminHome() { return <h1 className="display text-2xl font-bold">Admin</h1>; }
```

Run `pnpm --filter @heva/app dev`, open `http://localhost:4400/admin`. Expected: sidebar (grouped nav) + topbar + "Admin" heading, styled like the portal, dark mode working. (Task 4 replaces this page.)

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/components/admin apps/app/src/app/admin/layout.tsx apps/app/src/app/admin/page.tsx
git commit -m "feat(admin-ui): admin shell (sidebar + topbar) reusing the dashboard design system"
```

### Task 3: Shared presentational kit

**Files:**
- Create: `apps/app/src/components/admin/PageHeader.tsx`, `StatBadge.tsx`, `KpiTile.tsx`, `DataTable.tsx`, `SlideOver.tsx`

- [ ] **Step 1: PageHeader**

Create `apps/app/src/components/admin/PageHeader.tsx`:

```tsx
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 2: StatBadge** (reuses `.pill`, `.prio`)

Create `apps/app/src/components/admin/StatBadge.tsx`:

```tsx
import type { OrderStatus, Priority } from '@/data/adminMock';
import { statusLabel } from '@/data/adminMock';

const TONE: Record<string, string> = {
  new: 'pill-good', confirmed: 'pill-good', assigned: 'pill-good', in_progress: 'pill-warn',
  internal_review: 'pill-warn', delivered: 'pill-warn', changes_requested: 'pill-warn',
  approved: 'pill-live', completed: 'pill-live', canceled: 'pill',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`pill ${TONE[status] ?? 'pill'}`}>{statusLabel[status]}</span>;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`prio prio-${priority}`}>{priority}</span>;
}
```

- [ ] **Step 3: KpiTile** (reuses `.kpi`, `.kpi-glow`)

Create `apps/app/src/components/admin/KpiTile.tsx`:

```tsx
export function KpiTile({ icon, label, value, hint, tone = 'primary' }: { icon: string; label: string; value: string; hint?: string; tone?: 'primary' | 'warn' | 'good' }) {
  const toneColor = tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-500' : 'text-primary';
  return (
    <div className="kpi">
      <span className="kpi-glow" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${toneColor}`} />
      </div>
      <p className="display mt-auto text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 4: DataTable** (generic, typed columns)

Create `apps/app/src/components/admin/DataTable.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface Column<T> { key: string; header: string; align?: 'left' | 'right'; render: (row: T) => ReactNode; }

export function DataTable<T extends { id: string }>({ columns, rows, onRowHref }: { columns: Column<T>[]; rows: T[]; onRowHref?: (row: T) => string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => <th key={c.key} className={`p-3 ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/50 transition hover:bg-muted/40">
              {columns.map((c) => {
                const cell = <span>{c.render(row)}</span>;
                return (
                  <td key={c.key} className={`p-3 ${c.align === 'right' ? 'text-right' : ''}`}>
                    {onRowHref ? <a href={onRowHref(row)} className="block">{cell}</a> : cell}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length} className="p-6 text-center text-muted-foreground">Nothing here yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: SlideOver** (reuses `.order-panel` animation)

Create `apps/app/src/components/admin/SlideOver.tsx`:

```tsx
'use client';
export function SlideOver({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div onClick={onClose} className="order-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className="order-panel absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/components/admin/PageHeader.tsx apps/app/src/components/admin/StatBadge.tsx apps/app/src/components/admin/KpiTile.tsx apps/app/src/components/admin/DataTable.tsx apps/app/src/components/admin/SlideOver.tsx
git commit -m "feat(admin-ui): shared presentational kit (PageHeader, DataTable, badges, KpiTile, SlideOver)"
```

---

## Phase 1 — Command Center + Orders (template screens)

### Task 4: Command Center (`/admin`)

**Files:**
- Modify: `apps/app/src/app/admin/page.tsx` (replace the temp page)

- [ ] **Step 1: Build the page**

Replace `apps/app/src/app/admin/page.tsx`:

```tsx
import Link from 'next/link';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiTile } from '@/components/admin/KpiTile';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { KPIS, ORDERS, TICKETS, AUDIT, money } from '@/data/adminMock';

export default function CommandCenter() {
  const overdue = ORDERS.filter((o) => o.deadline && o.deadline < '2026-06-24' && o.status !== 'completed');
  const awaiting = ORDERS.filter((o) => o.status === 'delivered');
  const unassigned = ORDERS.filter((o) => !o.staff && o.status !== 'completed' && o.status !== 'canceled');

  return (
    <section>
      <PageHeader title="Command Center" subtitle="Live operational snapshot" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon="ph-tray" label="New orders" value={String(KPIS.newOrders)} hint="awaiting intake" />
        <KpiTile icon="ph-spinner-gap" label="In progress" value={String(KPIS.inProgress)} />
        <KpiTile icon="ph-warning" label="Overdue" value={String(KPIS.overdue)} tone="warn" />
        <KpiTile icon="ph-seal-check" label="Awaiting approval" value={String(KPIS.awaitingApproval)} />
        <KpiTile icon="ph-currency-dollar" label="Revenue today" value={money(KPIS.revenueToday)} tone="good" />
        <KpiTile icon="ph-chart-line-up" label="Revenue MTD" value={money(KPIS.revenueMtd)} tone="good" />
        <KpiTile icon="ph-lifebuoy" label="Open tickets" value={String(KPIS.openTickets)} />
        <KpiTile icon="ph-user-minus" label="Unassigned" value={String(KPIS.unassigned)} tone="warn" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <AttentionCard title="Overdue" href="/admin/orders" rows={overdue} />
        <AttentionCard title="Awaiting approval" href="/admin/review" rows={awaiting} />
        <AttentionCard title="Unassigned" href="/admin/assignment" rows={unassigned} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-scroll text-primary" /> Recent activity</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {AUDIT.map((a) => <li key={a.id}><span className="text-foreground">{a.at}</span> — {a.actor} · {a.change}</li>)}
        </ul>
      </div>
    </section>
  );
}

function AttentionCard({ title, href, rows }: { title: string; href: string; rows: typeof ORDERS }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <Link href={href} className="text-xs font-semibold text-primary hover:underline">View all</Link>
      </div>
      <ul className="space-y-2">
        {rows.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">{o.code}</span>
            <span className="flex items-center gap-1.5"><PriorityBadge priority={o.priority} /><StatusBadge status={o.status} /></span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted-foreground">All clear.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Reload `/admin`. Expected: 8 KPI tiles (glow + Inter Tight numbers), 3 attention cards with badges, recent activity list — all in the dashboard's dark/light theme.

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/app/admin/page.tsx
git commit -m "feat(admin-ui): command center screen"
```

### Task 5: Orders list (`/admin/orders`)

**Files:**
- Create: `apps/app/src/app/admin/orders/StatusFilter.tsx`, `apps/app/src/app/admin/orders/page.tsx`

- [ ] **Step 1: Status filter chips**

Create `apps/app/src/app/admin/orders/StatusFilter.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { statusLabel, type OrderStatus } from '@/data/adminMock';

const SHOWN: OrderStatus[] = ['new','confirmed','assigned','in_progress','internal_review','delivered','approved','completed'];

export function StatusFilter({ counts }: { counts: Partial<Record<OrderStatus, number>> }) {
  const active = useSearchParams().get('status');
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/admin/orders" className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${!active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>All</Link>
      {SHOWN.map((s) => (
        <Link key={s} href={`/admin/orders?status=${s}`} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${active === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>
          {statusLabel[s]} <span className="opacity-70">{counts[s] ?? 0}</span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Orders page**

Create `apps/app/src/app/admin/orders/page.tsx`:

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { StatusFilter } from './StatusFilter';
import { ORDERS, money, type AdminOrder, type OrderStatus } from '@/data/adminMock';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const rows = status ? ORDERS.filter((o) => o.status === status) : ORDERS;
  const counts = ORDERS.reduce<Partial<Record<OrderStatus, number>>>((a, o) => ({ ...a, [o.status]: (a[o.status] ?? 0) + 1 }), {});

  const columns: Column<AdminOrder>[] = [
    { key: 'code', header: 'Code', render: (o) => <span className="font-medium">{o.code}</span> },
    { key: 'customer', header: 'Customer', render: (o) => o.customer },
    { key: 'service', header: 'Service', render: (o) => <>{o.service} · <span className="text-muted-foreground">{o.pkg}</span></> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'priority', header: 'Priority', render: (o) => <PriorityBadge priority={o.priority} /> },
    { key: 'staff', header: 'Staff', render: (o) => o.staff ?? <span className="text-muted-foreground">—</span> },
    { key: 'value', header: 'Value', align: 'right', render: (o) => money(o.value) },
  ];

  return (
    <section>
      <PageHeader title="Orders" subtitle={`${rows.length} order${rows.length === 1 ? '' : 's'}`} />
      <StatusFilter counts={counts} />
      <DataTable columns={columns} rows={rows} onRowHref={(o) => `/admin/orders/${o.id}`} />
    </section>
  );
}
```

- [ ] **Step 3: Verify**

Visit `/admin/orders`. Expected: filter chips with counts, a styled table; clicking a chip filters; rows link to detail (404 until Task 6).

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/app/admin/orders/StatusFilter.tsx apps/app/src/app/admin/orders/page.tsx
git commit -m "feat(admin-ui): orders list with status filter"
```

### Task 6: Order detail (`/admin/orders/[id]`)

**Files:**
- Create: `apps/app/src/app/admin/orders/[id]/page.tsx`

- [ ] **Step 1: Build the detail page**

Create `apps/app/src/app/admin/orders/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { ORDERS, AUDIT, money } from '@/data/adminMock';

const NEXT: Record<string, string[]> = { new: ['Confirm','Cancel'], confirmed: ['Assign','Cancel'], assigned: ['Start'], in_progress: ['Internal review'], internal_review: ['Deliver'], delivered: ['Approve','Request changes'], approved: ['Complete'] };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = ORDERS.find((o) => o.id === id);
  if (!order) notFound();
  const actions = NEXT[order.status] ?? [];

  return (
    <section className="max-w-3xl">
      <PageHeader title={order.code} subtitle={`${order.service} · ${order.pkg} · ${money(order.value)} · ${order.source}`}
        actions={<><PriorityBadge priority={order.priority} /><StatusBadge status={order.status} /></>} />

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Actions</p>
        <div className="flex flex-wrap gap-2">
          {actions.length ? actions.map((a) => (
            <button key={a} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">{a}</button>
          )) : <span className="text-sm text-muted-foreground">No further actions.</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Customer</p>
          <p className="text-sm">{order.customer}</p>
          <p className="mt-2 text-sm font-semibold">Assigned staff</p>
          <p className="text-sm text-muted-foreground">{order.staff ?? 'Unassigned'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Deliverables</p>
          <p className="text-sm text-muted-foreground">No deliverables yet (module 4).</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Activity</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {AUDIT.filter((a) => a.change.startsWith(order.code)).map((a) => <li key={a.id}>{a.at} — {a.action}: {a.change}</li>)}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Click a row in `/admin/orders`. Expected: detail with header badges, action buttons matching the status, customer/deliverables/activity panels.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/admin/orders/[id]/page.tsx"
git commit -m "feat(admin-ui): order detail screen"
```

---

## Phase 2 — Remaining screens

> Each task: build the screen from the shared kit + `adminMock`, verify it renders in the browser, commit. They follow the Orders pattern (PageHeader + DataTable / cards).

### Task 7: Customers list (`/admin/customers`)

**Files:** Create `apps/app/src/app/admin/customers/page.tsx`

- [ ] **Step 1: Build**

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { CUSTOMERS, money, type AdminCustomer } from '@/data/adminMock';

export default function CustomersPage() {
  const columns: Column<AdminCustomer>[] = [
    { key: 'name', header: 'Customer', render: (c) => <><span className="font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.company}</span></> },
    { key: 'status', header: 'Status', render: (c) => <span className={`pill ${c.status === 'claimed' ? 'pill-live' : 'pill'}`}>{c.status}</span> },
    { key: 'orders', header: 'Orders', align: 'right', render: (c) => c.orders },
    { key: 'spend', header: 'Total spend', align: 'right', render: (c) => <span className="font-semibold">{money(c.spend)}</span> },
    { key: 'balance', header: 'Credit', align: 'right', render: (c) => money(c.balance) },
    { key: 'last', header: 'Last active', render: (c) => c.lastActive },
  ];
  return (
    <section>
      <PageHeader title="Customers" subtitle={`${CUSTOMERS.length} accounts`} />
      <DataTable columns={columns} rows={CUSTOMERS} onRowHref={(c) => `/admin/customers/${c.id}`} />
    </section>
  );
}
```

- [ ] **Step 2: Verify** `/admin/customers` renders the table (spend/credit right-aligned, status pills). **Commit:** `git add apps/app/src/app/admin/customers/page.tsx && git commit -m "feat(admin-ui): customers list"`

### Task 8: Customer detail (`/admin/customers/[id]`)

**Files:** Create `apps/app/src/app/admin/customers/[id]/page.tsx`

- [ ] **Step 1: Build**

```tsx
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiTile } from '@/components/admin/KpiTile';
import { StatusBadge } from '@/components/admin/StatBadge';
import { CUSTOMERS, ORDERS, money } from '@/data/adminMock';

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = CUSTOMERS.find((x) => x.id === id);
  if (!c) notFound();
  const orders = ORDERS.filter((o) => o.customer === c.company);
  return (
    <section className="max-w-4xl">
      <PageHeader title={c.name} subtitle={`${c.company} · ${c.email}`}
        actions={<button className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold">Adjust credit</button>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile icon="ph-coins" label="Total spend (LTV)" value={money(c.spend)} tone="good" />
        <KpiTile icon="ph-wallet" label="Credit balance" value={money(c.balance)} />
        <KpiTile icon="ph-package" label="Orders" value={String(c.orders)} />
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Ordered services</p>
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between text-sm">
              <a href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.code} · {o.service}</a>
              <span className="flex items-center gap-2"><StatusBadge status={o.status} /><span>{money(o.value)}</span></span>
            </li>
          ))}
          {orders.length === 0 && <li className="text-sm text-muted-foreground">No orders.</li>}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify** clicking a customer shows LTV/credit/orders tiles + ordered-services list. **Commit:** `git add "apps/app/src/app/admin/customers/[id]/page.tsx" && git commit -m "feat(admin-ui): customer detail"`

### Task 9: Staff list (`/admin/staff`)

**Files:** Create `apps/app/src/app/admin/staff/page.tsx`

- [ ] **Step 1: Build**

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { STAFF, type AdminStaff } from '@/data/adminMock';

export default function StaffPage() {
  const columns: Column<AdminStaff>[] = [
    { key: 'name', header: 'Staff', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'skills', header: 'Skills', render: (s) => <span className="flex flex-wrap gap-1">{s.skills.map((k) => <span key={k} className="pill pill-good">{k}</span>)}</span> },
    { key: 'load', header: 'Load', render: (s) => <span>{s.openLoad}/{s.capacity}</span> },
    { key: 'composite', header: 'Score', align: 'right', render: (s) => <span className="display font-bold text-primary">{s.composite}</span> },
    { key: 'onTime', header: 'On-time', align: 'right', render: (s) => `${s.onTime}%` },
    { key: 'throughput', header: 'Done', align: 'right', render: (s) => s.throughput },
  ];
  return (
    <section>
      <PageHeader title="Staff" subtitle={`${STAFF.length} members`} />
      <DataTable columns={columns} rows={STAFF} onRowHref={(s) => `/admin/staff/${s.id}`} />
    </section>
  );
}
```

- [ ] **Step 2: Verify** + **Commit:** `git add apps/app/src/app/admin/staff/page.tsx && git commit -m "feat(admin-ui): staff list"`

### Task 10: Staff detail (`/admin/staff/[id]`)

**Files:** Create `apps/app/src/app/admin/staff/[id]/page.tsx`

- [ ] **Step 1: Build**

```tsx
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiTile } from '@/components/admin/KpiTile';
import { STAFF } from '@/data/adminMock';

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = STAFF.find((x) => x.id === id);
  if (!s) notFound();
  return (
    <section className="max-w-3xl">
      <PageHeader title={s.name} subtitle={`Skills: ${s.skills.join(', ')} · capacity ${s.capacity}`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon="ph-medal" label="Composite" value={String(s.composite)} tone="good" />
        <KpiTile icon="ph-seal-check" label="Quality" value={`${s.quality}%`} />
        <KpiTile icon="ph-clock" label="On-time" value={`${s.onTime}%`} />
        <KpiTile icon="ph-package" label="Throughput" value={String(s.throughput)} />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Open load</p>
        <div className="mt-2 bar"><i style={{ width: `${(s.openLoad / s.capacity) * 100}%` }} /></div>
        <p className="mt-1 text-xs text-muted-foreground">{s.openLoad} of {s.capacity} slots in use</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify** (performance tiles + load bar) + **Commit:** `git add "apps/app/src/app/admin/staff/[id]/page.tsx" && git commit -m "feat(admin-ui): staff detail with performance"`

### Task 11: Assignment (`/admin/assignment`) — rules + workload

**Files:** Create `apps/app/src/app/admin/assignment/page.tsx`

- [ ] **Step 1: Build**

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { RULES, STAFF, type AdminRule } from '@/data/adminMock';

export default function AssignmentPage() {
  const columns: Column<AdminRule>[] = [
    { key: 'service', header: 'Service', render: (r) => <span className="font-medium">{r.service}{r.pkg ? ` · ${r.pkg}` : ''}</span> },
    { key: 'mode', header: 'Mode', render: (r) => <span className={`pill ${r.mode === 'pin' ? 'pill-warn' : 'pill-good'}`}>{r.mode}</span> },
    { key: 'target', header: 'Target', render: (r) => r.target ?? <span className="text-muted-foreground">skill pool</span> },
    { key: 'priority', header: 'Priority', align: 'right', render: (r) => r.priority },
    { key: 'active', header: '', align: 'right', render: (r) => <span className={`pill ${r.active ? 'pill-live' : 'pill'}`}>{r.active ? 'on' : 'off'}</span> },
  ];
  return (
    <section>
      <PageHeader title="Assignment" subtitle="Routing rules & staff workload"
        actions={<button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">New rule</button>} />
      <DataTable columns={columns} rows={RULES} />
      <p className="mb-3 mt-6 text-sm font-semibold">Workload</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAFF.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><span className="font-medium">{s.name}</span><span className="text-xs text-muted-foreground">{s.openLoad}/{s.capacity}</span></div>
            <div className="mt-2 bar"><i style={{ width: `${(s.openLoad / s.capacity) * 100}%` }} /></div>
            <p className="mt-1.5 text-xs text-muted-foreground">{s.skills.join(', ')}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify** (rules table + workload cards with load bars) + **Commit:** `git add apps/app/src/app/admin/assignment/page.tsx && git commit -m "feat(admin-ui): assignment rules + workload"`

### Task 12: Review queue (`/admin/review`)

**Files:** Create `apps/app/src/app/admin/review/page.tsx`

- [ ] **Step 1: Build**

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { ORDERS, money } from '@/data/adminMock';

export default function ReviewPage() {
  const queue = ORDERS.filter((o) => o.status === 'delivered' || o.status === 'internal_review');
  return (
    <section>
      <PageHeader title="Review queue" subtitle={`${queue.length} awaiting review`} />
      <div className="space-y-3">
        {queue.map((o) => (
          <div key={o.id} className="kcard flex items-center justify-between">
            <div>
              <a href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">{o.code}</a>
              <p className="text-xs text-muted-foreground">{o.customer} · {o.service} · {o.staff} · {money(o.value)}</p>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={o.priority} /><StatusBadge status={o.status} />
              <button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Approve</button>
              <button className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">Request changes</button>
            </div>
          </div>
        ))}
        {queue.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify** (kanban-style cards with approve/request-changes) + **Commit:** `git add apps/app/src/app/admin/review/page.tsx && git commit -m "feat(admin-ui): deliverable review queue"`

### Task 13: Tickets (`/admin/tickets`)

**Files:** Create `apps/app/src/app/admin/tickets/page.tsx`

- [ ] **Step 1: Build**

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { PriorityBadge } from '@/components/admin/StatBadge';
import { TICKETS, type AdminTicket } from '@/data/adminMock';

const TONE: Record<string, string> = { open: 'pill-warn', pending: 'pill', resolved: 'pill-live', closed: 'pill' };

export default function TicketsPage() {
  const columns: Column<AdminTicket>[] = [
    { key: 'subject', header: 'Subject', render: (t) => <span className="font-medium">{t.subject}</span> },
    { key: 'customer', header: 'Customer', render: (t) => t.customer },
    { key: 'status', header: 'Status', render: (t) => <span className={`pill ${TONE[t.status]}`}>{t.status}</span> },
    { key: 'priority', header: 'Priority', render: (t) => <PriorityBadge priority={t.priority} /> },
    { key: 'assignee', header: 'Assignee', render: (t) => t.assignee ?? <span className="text-muted-foreground">—</span> },
    { key: 'age', header: 'Age', align: 'right', render: (t) => t.age },
  ];
  return (
    <section>
      <PageHeader title="Tickets" subtitle={`${TICKETS.length} support tickets`} />
      <DataTable columns={columns} rows={TICKETS} />
    </section>
  );
}
```

- [ ] **Step 2: Verify** + **Commit:** `git add apps/app/src/app/admin/tickets/page.tsx && git commit -m "feat(admin-ui): tickets inbox"`

### Task 14: Finance (`/admin/finance`)

**Files:** Create `apps/app/src/app/admin/finance/page.tsx`

- [ ] **Step 1: Build**

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiTile } from '@/components/admin/KpiTile';
import { KPIS, ORDERS, money } from '@/data/adminMock';

export default function FinancePage() {
  const tx = ORDERS.map((o) => ({ id: o.id, label: `${o.code} · ${o.customer}`, amount: -o.value }));
  return (
    <section>
      <PageHeader title="Finance" subtitle="Revenue, credit & transactions" />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile icon="ph-currency-dollar" label="Revenue today" value={money(KPIS.revenueToday)} tone="good" />
        <KpiTile icon="ph-chart-line-up" label="Revenue MTD" value={money(KPIS.revenueMtd)} tone="good" />
        <KpiTile icon="ph-receipt" label="Outstanding" value={money(420)} tone="warn" />
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Recent transactions</p>
        <ul className="divide-y divide-border/60">
          {tx.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2 text-sm">
              <span>{t.label}</span>
              <span className={t.amount < 0 ? 'font-semibold text-foreground' : 'font-semibold text-emerald-500'}>{money(t.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify** + **Commit:** `git add apps/app/src/app/admin/finance/page.tsx && git commit -m "feat(admin-ui): finance overview"`

### Task 15: Catalog editor (`/admin/catalog`)

**Files:** Create `apps/app/src/app/admin/catalog/page.tsx`

- [ ] **Step 1: Build** (reads the real `SERVICE_CATALOG` to list services/packages; Edit/Publish are mock affordances)

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { SERVICE_CATALOG } from '@/data/services';

export default function CatalogPage() {
  const services = Object.values(SERVICE_CATALOG);
  return (
    <section>
      <PageHeader title="Catalog" subtitle="Services, packages & prices"
        actions={<button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Publish changes</button>} />
      <div className="space-y-3">
        {services.map((s) => {
          const pkgs = s.groups ? s.groups.flatMap((g) => g.packages) : (s.packages ?? []);
          return (
            <div key={s.key} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-semibold"><i className={`ph-bold ${s.icon} text-primary`} /> {s.name}</p>
                <button className="text-xs font-semibold text-primary hover:underline">Edit</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {pkgs.map((p) => (
                  <span key={p.id} className="rounded-lg border border-border px-2.5 py-1 text-xs">
                    {p.name} · <span className="font-semibold">{p.priceLabel ?? `$${p.price}`}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify** (services with their packages/prices + Edit/Publish buttons) + **Commit:** `git add apps/app/src/app/admin/catalog/page.tsx && git commit -m "feat(admin-ui): catalog editor screen"`

### Task 16: Analytics (`/admin/analytics`)

**Files:** Create `apps/app/src/app/admin/analytics/page.tsx`

- [ ] **Step 1: Build** (CSS bar charts from mock — no chart lib yet)

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { ORDERS, money } from '@/data/adminMock';

export default function AnalyticsPage() {
  const byService = Object.entries(ORDERS.reduce<Record<string, number>>((a, o) => ({ ...a, [o.service]: (a[o.service] ?? 0) + o.value }), {}));
  const max = Math.max(...byService.map(([, v]) => v), 1);
  const revWeek = [820, 1240, 980, 1510, 1320, 1740, 1610];
  const maxWeek = Math.max(...revWeek);
  return (
    <section>
      <PageHeader title="Analytics" subtitle="Revenue & service performance" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-semibold">Revenue (last 7 days)</p>
          <div className="flex h-40 items-end gap-2">
            {revWeek.map((v, i) => <div key={i} className="flex-1 rounded-t bg-primary/80" style={{ height: `${(v / maxWeek) * 100}%` }} title={money(v)} />)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-semibold">Revenue by service</p>
          <div className="space-y-2">
            {byService.map(([name, v]) => (
              <div key={name}>
                <div className="flex justify-between text-xs"><span>{name}</span><span className="font-semibold">{money(v)}</span></div>
                <div className="bar mt-1"><i style={{ width: `${(v / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify** (bar chart + service-mix bars) + **Commit:** `git add apps/app/src/app/admin/analytics/page.tsx && git commit -m "feat(admin-ui): analytics screen"`

### Task 17: Audit log (`/admin/audit`)

**Files:** Create `apps/app/src/app/admin/audit/page.tsx`

- [ ] **Step 1: Build**

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { AUDIT, type AuditEntry } from '@/data/adminMock';

export default function AuditPage() {
  const columns: Column<AuditEntry>[] = [
    { key: 'at', header: 'Time', render: (a) => <span className="text-muted-foreground">{a.at}</span> },
    { key: 'actor', header: 'Actor', render: (a) => a.actor },
    { key: 'entity', header: 'Entity', render: (a) => <span className="pill pill-good">{a.entity}</span> },
    { key: 'action', header: 'Action', render: (a) => a.action },
    { key: 'change', header: 'Change', render: (a) => <span className="font-medium">{a.change}</span> },
  ];
  return (
    <section>
      <PageHeader title="Audit log" subtitle="Who did what, when" />
      <DataTable columns={columns} rows={AUDIT} />
    </section>
  );
}
```

- [ ] **Step 2: Verify** + **Commit:** `git add apps/app/src/app/admin/audit/page.tsx && git commit -m "feat(admin-ui): audit log viewer"`

### Task 18: Settings (`/admin/settings`)

**Files:** Create `apps/app/src/app/admin/settings/Tabs.tsx`, `apps/app/src/app/admin/settings/page.tsx`

- [ ] **Step 1: Tabs (client)**

```tsx
'use client';
import { useState } from 'react';
const TABS = ['General', 'SLA', 'Routing & scoring', 'Email', 'Integrations', 'Admins'];
export function SettingsTabs() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-semibold transition ${tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t}</button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">{tab}</p>
        <p className="mt-1">Configuration for {tab.toLowerCase()} (mock). Wired to the settings store in the backend phase.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Page**

```tsx
import { PageHeader } from '@/components/admin/PageHeader';
import { SettingsTabs } from './Tabs';
export default function SettingsPage() {
  return (
    <section className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Templates, SLA, integrations, admins" />
      <SettingsTabs />
    </section>
  );
}
```

- [ ] **Step 3: Verify** (tabbed settings) + **Commit:** `git add apps/app/src/app/admin/settings && git commit -m "feat(admin-ui): settings tabs"`

---

## Final verification

- [ ] **Type-check:** `pnpm --filter @heva/app exec tsc --noEmit` → no errors.
- [ ] **Walk every route** with the dev server: `/admin`, `/admin/orders`, `/admin/orders/o1`, `/admin/assignment`, `/admin/review`, `/admin/tickets`, `/admin/customers`, `/admin/customers/c1`, `/admin/staff`, `/admin/staff/s1`, `/admin/finance`, `/admin/catalog`, `/admin/analytics`, `/admin/audit`, `/admin/settings` — each renders in the dashboard design system, light + dark.
- [ ] **Responsive:** sidebar collapses to the menu button under `lg`.

## Self-Review

- **Design-system reuse:** every screen uses `dashboard.css` classes (`.kpi`, `.pill`, `.kcard`, `.prio`, `.bar`, `.nav-item`, `.display`, `.order-panel`) + `@heva/ui` tokens; the portal's own `Sidebar`/`Topbar` are untouched (admin siblings created). ✓
- **No backend:** all data from `adminMock.ts` + the real `SERVICE_CATALOG` (read-only); no Supabase/auth/actions. ✓
- **Coverage:** all 13 modules have at least one screen (Command Center, Orders list+detail, Assignment, Review, Tickets, Customers list+detail, Staff list+detail, Finance, Catalog, Analytics, Audit, Settings). ✓
- **Type consistency:** `Column<T>`, `AdminOrder`/`AdminCustomer`/`AdminStaff`/`AdminTicket`/`AdminRule`/`AuditEntry`, `StatusBadge`/`PriorityBadge`, `KpiTile`, `money`, `statusLabel` used consistently across tasks. ✓
- **Wiring later:** when the backend plan runs, swap each screen's `adminMock` import for the real queries/Server Actions; the presentational kit stays.

