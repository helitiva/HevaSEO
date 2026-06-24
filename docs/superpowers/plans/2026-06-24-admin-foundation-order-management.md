# Admin Foundation + Order Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the admin backend (Supabase + master-admin auth + core schema + admin shell) and ship the Order Management module (orders table, order detail, state-machine-driven transitions) end-to-end.

**Architecture:** `apps/app` (Next 15 App Router, React 19) gains a Supabase Postgres backend (self-hosted via Docker, run locally with the Supabase CLI). Server Components read data (RLS-scoped); Server Actions perform all writes. The order lifecycle is governed by a single pure transition map shared by UI and server. Quick-checkout and dashboard orders share one `orders` table. Realtime + TanStack Query keep the orders table live.

**Tech Stack:** Next 15, React 19, Supabase (`@supabase/supabase-js` + `@supabase/ssr`), Postgres + RLS, TanStack Query v5, Zod, Vitest (unit/integration), Playwright (E2E), Tailwind + `@heva/ui`.

**Specs:** [order-management-design.md](../specs/2026-06-24-order-management-design.md) · [admin-dashboard-overview.md](../specs/2026-06-24-admin-dashboard-overview.md)

---

## Conventions

- All commands run from the repo root unless stated. App lives in `apps/app`; run app-scoped commands with `pnpm --filter @heva/app <cmd>` (the package name in `apps/app/package.json`).
- Money is integer **cents**. Never floats. Prices come from the catalog server-side.
- Status strings are the lowercase machine values in Task 6; labels are derived for display.
- Commit after every green test (messages use conventional-commit prefixes).

## File Structure (created/modified)

**Foundation**
- `apps/app/supabase/config.toml` — Supabase CLI project config (created by `supabase init`).
- `apps/app/supabase/migrations/0001_core_schema.sql` — enums + ~10 core tables.
- `apps/app/supabase/migrations/0002_rls.sql` — RLS policies (master-admin full, role-ready).
- `apps/app/supabase/seed.sql` — dev seed (1 admin profile, customers, orders).
- `apps/app/src/lib/supabase/server.ts` — RLS-scoped server client (cookies).
- `apps/app/src/lib/supabase/client.ts` — browser client (Realtime).
- `apps/app/src/lib/supabase/service.ts` — service-role client (server-only, bypasses RLS).
- `apps/app/src/lib/supabase/database.types.ts` — generated DB types.
- `apps/app/src/middleware.ts` — refresh session + gate `/(admin)` and `/orders`.
- `apps/app/src/app/login/page.tsx` + `login/actions.ts` — master-admin login at `/login` (outside the guarded `/admin`).
- `apps/app/src/app/admin/layout.tsx` + `apps/app/src/data/adminNav.ts` — admin shell (guards `/admin/*`).
- `apps/app/src/app/providers.tsx` — TanStack Query provider; wired in `src/app/layout.tsx`.
- `apps/app/.env.example` (committed) + `.env.local` (gitignored).

**Order domain (pure, unit-tested)**
- `apps/app/src/lib/orders/types.ts` — `OrderStatus`, `Order`, `Priority`.
- `apps/app/src/lib/orders/state-machine.ts` — transition map, `nextStates`, `canTransition`, `isTerminal`.
- `apps/app/src/lib/orders/pricing.ts` — `orderValueCents(service, packageId, addons)`.
- `apps/app/src/lib/orders/sla.ts` — `isOverdue`, `slaState`.
- `apps/app/src/lib/orders/code.ts` — `makeOrderCode(serviceKey)`.

**Data access + actions**
- `apps/app/src/lib/orders/queries.ts` — `listOrders(filters)`, `getOrder(id)`.
- `apps/app/src/app/admin/orders/actions.ts` — `confirmOrder`/`transitionOrder`/`assignOrder`/`cancelOrder`.

**UI**
- `apps/app/src/app/admin/orders/page.tsx` — server component (reads + passes to table).
- `apps/app/src/app/admin/orders/filters.ts` — URL search-param parsing/serialization.
- `apps/app/src/app/admin/orders/OrdersTable.tsx` — client table (TanStack Query + Realtime + bulk).
- `apps/app/src/app/admin/orders/StatusStrip.tsx` — per-status counts.
- `apps/app/src/app/admin/orders/[id]/page.tsx` — order detail.
- `apps/app/src/app/admin/orders/[id]/TransitionButtons.tsx` — client transition controls.

**Test config**
- `apps/app/vitest.config.ts`, `apps/app/playwright.config.ts`, `apps/app/e2e/orders.spec.ts`.

---

## Phase 0 — Foundation

### Task 1: Test tooling (Vitest)

**Files:**
- Modify: `apps/app/package.json` (scripts + devDeps)
- Create: `apps/app/vitest.config.ts`
- Create: `apps/app/src/lib/orders/smoke.test.ts` (temporary)

- [ ] **Step 1: Install Vitest**

Run: `pnpm --filter @heva/app add -D vitest @vitest/coverage-v8`
Expected: packages added to `apps/app/package.json` devDependencies.

- [ ] **Step 2: Add config**

Create `apps/app/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 3: Add scripts**

In `apps/app/package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test**

Create `apps/app/src/lib/orders/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
describe('tooling', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 5: Run it**

Run: `pnpm --filter @heva/app test`
Expected: PASS (1 test). Then delete the smoke file: `rm apps/app/src/lib/orders/smoke.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/app/package.json apps/app/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(app): add vitest test runner"
```

### Task 2: Local Supabase

**Files:**
- Create: `apps/app/supabase/config.toml` (via CLI)
- Create/modify: `apps/app/.env.example`, `apps/app/.env.local` (gitignored)

- [ ] **Step 1: Init Supabase project**

Run: `cd apps/app && npx --yes supabase init`
Expected: creates `apps/app/supabase/config.toml` and `apps/app/supabase/` dir. Accept defaults.

- [ ] **Step 2: Start Supabase (Docker)**

Run: `cd apps/app && npx --yes supabase start`
Expected: prints `API URL`, `anon key`, `service_role key`, `DB URL`. (Requires Docker running.)

- [ ] **Step 3: Capture env**

Create `apps/app/.env.example` (committed):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=__from_supabase_start__
SUPABASE_SERVICE_ROLE_KEY=__from_supabase_start__   # server-only, never NEXT_PUBLIC
```

Create `apps/app/.env.local` with the real values printed in Step 2. Confirm `.env.local` is gitignored (root `.gitignore` already ignores `.env*` per master-plan §9; if not, add `apps/app/.env.local`).

- [ ] **Step 4: Commit**

```bash
git add apps/app/supabase/config.toml apps/app/.env.example
git commit -m "chore(app): init local supabase (docker)"
```

### Task 3: Core schema migration

**Files:**
- Create: `apps/app/supabase/migrations/0001_core_schema.sql`

> Order Management writes/reads: `profiles`, `customers`, `orders`, `credit_ledger`, `audit_log`, `notifications`. `tasks`/`deliverables`/`messages` are deferred to their own modules; `assigned_staff_id` lives on `orders` so the detail page works without them. Catalog (`services`/`packages`) stays in `@heva/catalog` — orders reference it by `service_key`/`package_id` text.

- [ ] **Step 1: Write the migration**

Create `apps/app/supabase/migrations/0001_core_schema.sql`:

```sql
-- Enums --------------------------------------------------------------
create type order_status as enum (
  'new','confirmed','assigned','in_progress','internal_review',
  'delivered','changes_requested','approved','completed','canceled'
);
create type order_priority as enum ('low','med','high');
create type order_source   as enum ('quick','dashboard');
create type user_role       as enum ('master_admin','staff','customer');

-- Profiles (1:1 with auth.users) -------------------------------------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       user_role not null default 'master_admin',
  created_at timestamptz not null default now()
);

-- Customers ----------------------------------------------------------
create table customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  company    text,
  email      text not null,
  status     text not null default 'shadow',  -- 'shadow' | 'claimed'
  notes      text,
  created_at timestamptz not null default now()
);

-- Credit ledger (balance is always summed from here) -----------------
create table credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  order_id    uuid,                  -- nullable; set on debit/refund
  delta_cents integer not null,      -- + topup, - debit
  reason      text not null,
  created_at  timestamptz not null default now()
);
create view customer_balances as
  select customer_id, coalesce(sum(delta_cents),0)::int as balance_cents
  from credit_ledger group by customer_id;

-- Orders -------------------------------------------------------------
create table orders (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  customer_id       uuid not null references customers(id),
  service_key       text not null,
  package_id        text,
  status            order_status not null default 'new',
  priority          order_priority not null default 'med',
  source            order_source not null default 'dashboard',
  value_cents       integer not null,
  currency          text not null default 'USD',
  brief             jsonb not null default '{}'::jsonb,
  assigned_staff_id uuid references profiles(id),
  deadline_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index orders_status_idx  on orders(status);
create index orders_created_idx on orders(created_at desc);

-- Audit log ----------------------------------------------------------
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id),
  entity      text not null,        -- 'order'
  entity_id   uuid not null,
  action      text not null,        -- 'transition' | 'assign' | 'cancel' | 'edit'
  from_status order_status,
  to_status   order_status,
  meta        jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);

-- Notifications ------------------------------------------------------
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type         text not null,
  payload      jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
```

- [ ] **Step 2: Apply it**

Run: `cd apps/app && npx supabase db reset`
Expected: migration applies; prints "Applying migration 0001_core_schema.sql..." with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/app/supabase/migrations/0001_core_schema.sql
git commit -m "feat(db): core schema (orders, customers, credit_ledger, audit_log)"
```

### Task 4: RLS policies (master-admin, role-ready)

**Files:**
- Create: `apps/app/supabase/migrations/0002_rls.sql`

- [ ] **Step 1: Write the policies**

Create `apps/app/supabase/migrations/0002_rls.sql`:

```sql
-- Helper: is the current user a master admin? ------------------------
create or replace function is_master_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'master_admin'
  );
$$;

alter table profiles      enable row level security;
alter table customers     enable row level security;
alter table credit_ledger enable row level security;
alter table orders        enable row level security;
alter table audit_log     enable row level security;
alter table notifications enable row level security;

-- Master admin: full access. (Staff/customer policies added later.) --
create policy admin_all_profiles      on profiles      for all using (is_master_admin()) with check (is_master_admin());
create policy admin_all_customers     on customers     for all using (is_master_admin()) with check (is_master_admin());
create policy admin_all_ledger        on credit_ledger for all using (is_master_admin()) with check (is_master_admin());
create policy admin_all_orders        on orders        for all using (is_master_admin()) with check (is_master_admin());
create policy admin_all_audit         on audit_log     for all using (is_master_admin()) with check (is_master_admin());
create policy admin_all_notifications on notifications for all using (is_master_admin()) with check (is_master_admin());

-- A user can always read their own profile (needed for is_master_admin bootstrap).
create policy self_read_profile on profiles for select using (id = auth.uid());
```

- [ ] **Step 2: Apply**

Run: `cd apps/app && npx supabase db reset`
Expected: both migrations apply cleanly (`0001…`, `0002…`). RLS being active is verified behaviorally in Task 15 (anon reads return 0 rows).

- [ ] **Step 3: Commit**

```bash
git add apps/app/supabase/migrations/0002_rls.sql
git commit -m "feat(db): RLS policies (master-admin full, role-ready)"
```

### Task 5: Supabase clients + generated types

**Files:**
- Create: `apps/app/src/lib/supabase/server.ts`, `client.ts`, `service.ts`, `database.types.ts`
- Modify: `apps/app/package.json` (deps)

- [ ] **Step 1: Install SDK**

Run: `pnpm --filter @heva/app add @supabase/supabase-js @supabase/ssr`

- [ ] **Step 2: Generate DB types**

Run: `cd apps/app && npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`
Expected: a `Database` type is written. (Re-run after every migration.)

- [ ] **Step 3: Server client (RLS-scoped, cookies)**

Create `apps/app/src/lib/supabase/server.ts`:

```ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* called from a Server Component render; middleware refreshes instead */ }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Browser client (Realtime)**

Create `apps/app/src/lib/supabase/client.ts`:

```ts
'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export const supabaseBrowser = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
```

- [ ] **Step 5: Service-role client (server-only, bypasses RLS)**

Create `apps/app/src/lib/supabase/service.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Use ONLY in trusted server code that must bypass RLS (e.g. webhook order insert).
export const supabaseService = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
```

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/lib/supabase apps/app/package.json pnpm-lock.yaml
git commit -m "feat(app): supabase server/browser/service clients + db types"
```

### Task 6: Master-admin auth + middleware

**Files:**
- Create: `apps/app/src/middleware.ts`
- Create: `apps/app/src/app/login/page.tsx`, `apps/app/src/app/login/actions.ts`

> Login lives at `/login` (top-level, **outside** `/admin`) so it renders for logged-out users without tripping the `/admin` guard. Middleware gates `/admin/*` and redirects to `/login`.

- [ ] **Step 1: Middleware — refresh session + gate `/admin/*`**

Create `apps/app/src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  // matcher restricts this to /admin/* only, so any unauthenticated hit redirects to /login.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ['/admin/:path*'] };
```

- [ ] **Step 2: Login server action**

Create `apps/app/src/app/login/actions.ts`:

```ts
'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Creds = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function login(_prev: unknown, formData: FormData) {
  const parsed = Creds.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: 'Enter a valid email and password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: 'Invalid credentials.' };
  redirect('/admin/orders');
}
```

- [ ] **Step 3: Login page**

Create `apps/app/src/app/login/page.tsx`:

```tsx
'use client';
import { useActionState } from 'react';
import { login } from './actions';

export default function AdminLogin() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="display text-xl font-bold">Admin sign in</h1>
        <input name="email" type="email" required placeholder="Email" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input name="password" type="password" required placeholder="Password" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @heva/app dev` and visit `http://localhost:4400/admin/orders`.
Expected: redirected to `/login` (no session yet). Leave the server running for later tasks.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/middleware.ts apps/app/src/app/login
git commit -m "feat(app): master-admin auth (login at /login + middleware gate /admin)"
```

### Task 7: Admin shell + TanStack Query provider

**Files:**
- Create: `apps/app/src/data/adminNav.ts`, `apps/app/src/app/admin/QueryProvider.tsx`, `apps/app/src/app/admin/layout.tsx`
- Modify: `apps/app/package.json` (TanStack Query)

- [ ] **Step 1: Install TanStack Query**

Run: `pnpm --filter @heva/app add @tanstack/react-query`

- [ ] **Step 2: Query provider**

Create `apps/app/src/app/admin/QueryProvider.tsx`:

```tsx
'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Admin nav data**

Create `apps/app/src/data/adminNav.ts`:

```ts
export interface AdminNavItem { label: string; href: string; icon: string; }
export const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Overview', href: '/admin', icon: 'ph-squares-four' },
  { label: 'Orders', href: '/admin/orders', icon: 'ph-kanban' },
  { label: 'Customers', href: '/admin/customers', icon: 'ph-users' },
  { label: 'Catalog', href: '/admin/catalog', icon: 'ph-tag' },
];
```

- [ ] **Step 4: Admin layout (auth guard + shell)**

Create `apps/app/src/app/admin/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_NAV } from '@/data/adminNav';
import { QueryProvider } from './QueryProvider';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'master_admin') redirect('/admin/login');

  return (
    <QueryProvider>
      <div className="grid min-h-screen grid-cols-[220px_1fr]">
        <aside className="border-r border-border bg-card p-4">
          <p className="display mb-4 text-lg font-bold">HevaSEO <span className="text-primary">Admin</span></p>
          <nav className="space-y-1">
            {ADMIN_NAV.map((i) => (
              <Link key={i.href} href={i.href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">
                <i className={`ph-bold ${i.icon}`} /> {i.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 p-6">{children}</main>
      </div>
    </QueryProvider>
  );
}
```

> Login is at `/login` (Task 6), **outside** `/admin`, so `admin/layout.tsx`'s guard never runs for it — no extra login layout needed. The guard here is belt-and-suspenders alongside the middleware (defence in depth: middleware can be bypassed by direct RSC requests).

- [ ] **Step 5: Verify the shell**

With the dev server running, sign in at `/login`, then visit `/admin`.
Expected: the admin shell renders (sidebar + empty Overview). Visiting `/admin` while logged out → redirected to `/login`.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/app/admin apps/app/src/data/adminNav.ts apps/app/package.json pnpm-lock.yaml
git commit -m "feat(app): admin shell (guarded layout) + query provider"
```

### Task 8: Dev seed (admin user + customers + orders)

**Files:**
- Create: `apps/app/scripts/create-admin.mjs`, `apps/app/supabase/seed.sql`

- [ ] **Step 1: Create-admin script (service role)**

Create `apps/app/scripts/create-admin.mjs`:

```js
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [email, password] = [process.env.ADMIN_EMAIL || 'admin@hevaseo.com', process.env.ADMIN_PASSWORD || 'changeme123'];
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error) { console.error(error); process.exit(1); }
await sb.from('profiles').insert({ id: data.user.id, email, role: 'master_admin', full_name: 'Master Admin' });
console.log('Created master admin:', email);
```

- [ ] **Step 2: Seed file (auto-applied on `db reset`)**

Create `apps/app/supabase/seed.sql`:

```sql
insert into customers (id, name, company, email, status) values
  ('11111111-1111-1111-1111-111111111111','Jane Doe','Acme Co','jane@acme.com','claimed'),
  ('22222222-2222-2222-2222-222222222222','Sam Lee','Bright Ltd','sam@bright.io','shadow');

insert into credit_ledger (customer_id, delta_cents, reason) values
  ('11111111-1111-1111-1111-111111111111', 20000, 'Initial top-up');

insert into orders (code, customer_id, service_key, package_id, status, priority, source, value_cents, brief) values
  ('AUD-1001','11111111-1111-1111-1111-111111111111','audit','standard','new','high','quick', 3900, '{"website":"acme.com"}'),
  ('KW-1002','22222222-2222-2222-2222-222222222222','keyword','standard','new','med','dashboard', 3900, '{"website":"bright.io"}');
```

- [ ] **Step 3: Reset DB, then create the admin user**

`seed.sql` is applied automatically by `supabase db reset`. The admin **auth** user must be (re)created after every reset (reset clears `auth.users`).

Run: `cd apps/app && npx supabase db reset`
Then run: `cd apps/app && node --env-file=.env.local scripts/create-admin.mjs`
Expected: customers/orders seeded by reset; `Created master admin: admin@hevaseo.com`.

- [ ] **Step 4: Verify login end-to-end**

With dev server running, visit `/login`, sign in with `admin@hevaseo.com` / `changeme123`.
Expected: redirected to `/admin/orders` (will 404/empty until Phase 3 — that's fine; no redirect back to `/login` means auth works).

- [ ] **Step 5: Commit**

```bash
git add apps/app/scripts/create-admin.mjs apps/app/supabase/seed.sql
git commit -m "chore(db): dev seed (master admin + customers + orders)"
```

---

## Phase 1 — Order domain (pure logic, TDD)

### Task 9: Order types + state machine

**Files:**
- Create: `apps/app/src/lib/orders/types.ts`
- Create: `apps/app/src/lib/orders/state-machine.ts`
- Test: `apps/app/src/lib/orders/state-machine.test.ts`

- [ ] **Step 1: Types**

Create `apps/app/src/lib/orders/types.ts`:

```ts
export type OrderStatus =
  | 'new' | 'confirmed' | 'assigned' | 'in_progress' | 'internal_review'
  | 'delivered' | 'changes_requested' | 'approved' | 'completed' | 'canceled';

export type Priority = 'low' | 'med' | 'high';
export type OrderSource = 'quick' | 'dashboard';
```

- [ ] **Step 2: Write the failing test**

Create `apps/app/src/lib/orders/state-machine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TRANSITIONS, nextStates, canTransition, isTerminal } from './state-machine';
import type { OrderStatus } from './types';

const ALL: OrderStatus[] = ['new','confirmed','assigned','in_progress','internal_review','delivered','changes_requested','approved','completed','canceled'];

describe('order state machine', () => {
  it('defines a transition list for every status', () => {
    ALL.forEach((s) => expect(TRANSITIONS[s]).toBeDefined());
  });
  it('allows New → Confirmed and New → Canceled only', () => {
    expect(nextStates('new')).toEqual(['confirmed', 'canceled']);
  });
  it('permits valid transitions and rejects invalid ones', () => {
    expect(canTransition('delivered', 'approved')).toBe(true);
    expect(canTransition('delivered', 'changes_requested')).toBe(true);
    expect(canTransition('new', 'completed')).toBe(false);
    expect(canTransition('completed', 'new')).toBe(false);
  });
  it('lets internal_review kick back to in_progress', () => {
    expect(canTransition('internal_review', 'in_progress')).toBe(true);
  });
  it('marks completed and canceled as terminal', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('canceled')).toBe(true);
    expect(isTerminal('new')).toBe(false);
  });
});
```

- [ ] **Step 3: Run it (fails)**

Run: `pnpm --filter @heva/app test state-machine`
Expected: FAIL — `state-machine` module not found.

- [ ] **Step 4: Implement**

Create `apps/app/src/lib/orders/state-machine.ts`:

```ts
import type { OrderStatus } from './types';

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new:               ['confirmed', 'canceled'],
  confirmed:         ['assigned', 'canceled'],
  assigned:          ['in_progress'],
  in_progress:       ['internal_review'],
  internal_review:   ['delivered', 'in_progress'],
  delivered:         ['approved', 'changes_requested'],
  changes_requested: ['in_progress'],
  approved:          ['completed'],
  completed:         [],
  canceled:          [],
};

export const nextStates = (s: OrderStatus): OrderStatus[] => TRANSITIONS[s];
export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => TRANSITIONS[from].includes(to);
export const isTerminal = (s: OrderStatus): boolean => TRANSITIONS[s].length === 0;
```

- [ ] **Step 5: Run it (passes)**

Run: `pnpm --filter @heva/app test state-machine`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/lib/orders/types.ts apps/app/src/lib/orders/state-machine.ts apps/app/src/lib/orders/state-machine.test.ts
git commit -m "feat(orders): order status types + state machine"
```

### Task 10: Order value (pure `valueCents` + catalog resolver)

**Files:**
- Create: `apps/app/src/lib/orders/pricing.ts`
- Test: `apps/app/src/lib/orders/pricing.test.ts`

- [ ] **Step 1: Write the failing test (pure function only)**

Create `apps/app/src/lib/orders/pricing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { valueCents } from './pricing';

describe('valueCents', () => {
  it('returns a flat package price in cents', () => {
    expect(valueCents({ id: 'standard', price: 39 }, [])).toBe(3900);
  });
  it('adds chosen add-on tier prices', () => {
    expect(valueCents({ id: 'standard', price: 39 }, [33, 17])).toBe(8900);
  });
  it('multiplies by qty for bulk services', () => {
    expect(valueCents({ id: 'a1000', price: 12 }, [], 10, true)).toBe(12000);
  });
  it('is 0 when no package (consult/quote) and no add-ons', () => {
    expect(valueCents(undefined, [])).toBe(0);
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `pnpm --filter @heva/app test pricing`
Expected: FAIL — `pricing` module not found.

- [ ] **Step 3: Implement (pure fn + catalog resolver)**

Create `apps/app/src/lib/orders/pricing.ts`:

```ts
import { getAddOn } from '@heva/catalog';
import { SERVICE_CATALOG } from '@/data/services';

export interface PricingPackage { id: string; price: number; } // dollars

/** Pure: order value in integer cents. Tested in isolation. */
export function valueCents(
  pkg: PricingPackage | undefined,
  addonTierPrices: number[],
  qty = 1,
  isBulk = false,
): number {
  const base = isBulk ? (pkg?.price ?? 0) * qty : (pkg?.price ?? 0);
  const addons = addonTierPrices.reduce((sum, p) => sum + p, 0);
  return Math.round((base + addons) * 100);
}

export interface AddonPick { id: string; tierId: string; }

/**
 * Resolver: looks up the real catalog server-side and returns the snapshot value.
 * Never trusts a client-supplied price. Covered by the confirmOrder integration test.
 */
export function orderValueCents(
  serviceKey: string,
  packageId: string | null,
  addons: AddonPick[] = [],
  qty = 1,
): number {
  const svc = SERVICE_CATALOG[serviceKey];
  if (!svc) throw new Error(`Unknown service: ${serviceKey}`);
  const allPkgs = svc.groups ? svc.groups.flatMap((g) => g.packages) : (svc.packages ?? []);
  const pkg = allPkgs.find((p) => p.id === packageId);
  const addonPrices = addons.map((pick) => {
    const a = getAddOn(pick.id);
    const tier = a?.tiers.find((t) => t.id === pick.tierId) ?? a?.tiers[0];
    return tier?.price ?? 0;
  });
  return valueCents(pkg, addonPrices, qty, Boolean(svc.bulk || svc.usage));
}
```

- [ ] **Step 4: Run it (passes)**

Run: `pnpm --filter @heva/app test pricing`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/orders/pricing.ts apps/app/src/lib/orders/pricing.test.ts
git commit -m "feat(orders): order value snapshot (pure valueCents + catalog resolver)"
```

### Task 11: SLA / overdue

**Files:**
- Create: `apps/app/src/lib/orders/sla.ts`
- Test: `apps/app/src/lib/orders/sla.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/lib/orders/sla.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isOverdue, slaState } from './sla';
import type { OrderStatus } from './types';

const now = new Date('2026-06-24T12:00:00Z');

describe('sla', () => {
  it('is not overdue without a deadline', () => {
    expect(isOverdue(null, 'in_progress', now)).toBe(false);
  });
  it('is overdue when the deadline passed and the order is open', () => {
    expect(isOverdue('2026-06-23T12:00:00Z', 'in_progress', now)).toBe(true);
  });
  it('is never overdue when terminal', () => {
    expect(isOverdue('2026-06-23T12:00:00Z', 'completed' as OrderStatus, now)).toBe(false);
  });
  it('flags due-soon within 24h', () => {
    expect(slaState('2026-06-25T06:00:00Z', 'assigned', now)).toBe('due_soon');
    expect(slaState('2026-06-30T06:00:00Z', 'assigned', now)).toBe('on_track');
    expect(slaState('2026-06-23T06:00:00Z', 'assigned', now)).toBe('overdue');
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `pnpm --filter @heva/app test sla`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `apps/app/src/lib/orders/sla.ts`:

```ts
import { isTerminal } from './state-machine';
import type { OrderStatus } from './types';

const DUE_SOON_MS = 24 * 60 * 60 * 1000;

export function isOverdue(deadlineAt: string | null, status: OrderStatus, now = new Date()): boolean {
  if (!deadlineAt || isTerminal(status)) return false;
  return new Date(deadlineAt).getTime() < now.getTime();
}

export type SlaState = 'on_track' | 'due_soon' | 'overdue';

export function slaState(deadlineAt: string | null, status: OrderStatus, now = new Date()): SlaState {
  if (isOverdue(deadlineAt, status, now)) return 'overdue';
  if (!deadlineAt || isTerminal(status)) return 'on_track';
  const left = new Date(deadlineAt).getTime() - now.getTime();
  return left <= DUE_SOON_MS ? 'due_soon' : 'on_track';
}
```

- [ ] **Step 4: Run it (passes)**

Run: `pnpm --filter @heva/app test sla`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/orders/sla.ts apps/app/src/lib/orders/sla.test.ts
git commit -m "feat(orders): SLA / overdue computation"
```

### Task 12: Order code generation

**Files:**
- Create: `apps/app/src/lib/orders/code.ts`
- Test: `apps/app/src/lib/orders/code.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/lib/orders/code.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeOrderCode } from './code';

describe('makeOrderCode', () => {
  it('prefixes by service and appends 4 digits', () => {
    const code = makeOrderCode('audit', () => 0.5);
    expect(code).toMatch(/^AUD-\d{4}$/);
    expect(code).toBe('AUD-5500');
  });
  it('maps known services to short prefixes', () => {
    expect(makeOrderCode('keyword', () => 0)).toBe('KW-1000');
    expect(makeOrderCode('website', () => 0)).toBe('WEB-1000');
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `pnpm --filter @heva/app test code`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `apps/app/src/lib/orders/code.ts`:

```ts
const PREFIX: Record<string, string> = {
  audit: 'AUD', keyword: 'KW', content: 'CNT', backlink: 'BL',
  optimize: 'OPT', design: 'WD', indexer: 'IDX',
};

/** Human-friendly order code, e.g. AUD-1234. `rng` is injectable for tests. */
export function makeOrderCode(serviceKey: string, rng: () => number = Math.random): string {
  const prefix = PREFIX[serviceKey] ?? serviceKey.slice(0, 3).toUpperCase();
  const n = 1000 + Math.floor(rng() * 9000);
  return `${prefix}-${n}`;
}
```

- [ ] **Step 4: Run it (passes)**

Run: `pnpm --filter @heva/app test code`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/orders/code.ts apps/app/src/lib/orders/code.test.ts
git commit -m "feat(orders): order code generation"
```

---

## Phase 2 — Data access + Server Actions

> **Design:** business rules live in pure-ish `*Tx(db, …)` functions that take a Supabase client, so they are **integration-tested** against the local DB. `'use server'` actions are thin wrappers that resolve the client + current admin, call the Tx, and `revalidatePath`. Integration tests use the **service-role** client (bypasses RLS) to arrange/inspect; RLS itself is verified separately in Task 15 Step 6.

### Task 13: Integration-test harness + order queries

**Files:**
- Modify: `apps/app/package.json` (dotenv), `apps/app/vitest.config.ts`
- Create: `apps/app/vitest.setup.ts`, `apps/app/src/test/db.ts`
- Create: `apps/app/src/lib/orders/queries.ts`
- Test: `apps/app/src/lib/orders/queries.test.ts`

- [ ] **Step 1: Env loading for integration tests**

Run: `pnpm --filter @heva/app add -D dotenv`

Create `apps/app/vitest.setup.ts`:

```ts
import { config } from 'dotenv';
config({ path: '.env.local' });
```

Update `apps/app/vitest.config.ts` to add `setupFiles`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'], setupFiles: ['./vitest.setup.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 2: Test DB helper**

Create `apps/app/src/test/db.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Service-role client for tests: bypasses RLS to arrange/inspect data.
export const testDb = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

export const ADMIN_ID = '00000000-0000-0000-0000-0000000000aa';

/** Insert a customer with an optional credit balance; returns the id. */
export async function makeCustomer(db: ReturnType<typeof testDb>, balanceCents = 0) {
  const { data } = await db.from('customers').insert({ name: 'T', email: `t${Date.now()}@x.io`, status: 'shadow' }).select('id').single();
  if (balanceCents) await db.from('credit_ledger').insert({ customer_id: data!.id, delta_cents: balanceCents, reason: 'test topup' });
  return data!.id as string;
}

/** Insert an order in a given status; returns the row. */
export async function makeOrder(db: ReturnType<typeof testDb>, customerId: string, overrides: Record<string, unknown> = {}) {
  const { data } = await db.from('orders').insert({
    code: `T-${Math.floor(Math.random() * 1e6)}`, customer_id: customerId,
    service_key: 'audit', package_id: 'standard', status: 'new', value_cents: 3900, source: 'dashboard', ...overrides,
  }).select('*').single();
  return data!;
}
```

> The integration tests need an admin `profiles` row with id `ADMIN_ID` for FK refs (`audit_log.actor_id`). Add it to `seed.sql` (insert into `profiles` requires a matching `auth.users` row, so instead the test inserts the audit actor as `null` when no real admin id is available — see Task 14). For simplicity, tests pass `actorId = null` to Tx functions; production wrappers pass the real user id.

- [ ] **Step 3: Write the failing query test**

Create `apps/app/src/lib/orders/queries.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { testDb, makeCustomer, makeOrder } from '@/test/db';
import { listOrders, getOrder } from './queries';

const db = testDb();
let orderId: string;

beforeAll(async () => {
  const c = await makeCustomer(db);
  const o = await makeOrder(db, c, { status: 'new', service_key: 'audit' });
  orderId = o.id;
});

describe('order queries', () => {
  it('lists orders filtered by status', async () => {
    const rows = await listOrders(db, { status: 'new' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status === 'new')).toBe(true);
  });
  it('gets one order by id', async () => {
    const o = await getOrder(db, orderId);
    expect(o?.id).toBe(orderId);
    expect(o?.service_key).toBe('audit');
  });
});
```

- [ ] **Step 4: Run it (fails)**

Run: `pnpm --filter @heva/app test queries`
Expected: FAIL — `queries` module not found. (If it errors on env/DB, ensure `supabase start` is running and `.env.local` is populated.)

- [ ] **Step 5: Implement queries**

Create `apps/app/src/lib/orders/queries.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { OrderStatus, Priority, OrderSource } from './types';

type DB = SupabaseClient<Database>;
export type OrderRow = Database['public']['Tables']['orders']['Row'];

export interface OrderFilters {
  status?: OrderStatus;
  serviceKey?: string;
  source?: OrderSource;
  priority?: Priority;
  search?: string;
  sort?: 'created' | 'deadline' | 'value';
  page?: number;
  pageSize?: number;
}

export async function listOrders(db: DB, f: OrderFilters = {}): Promise<OrderRow[]> {
  const size = f.pageSize ?? 25;
  const from = ((f.page ?? 1) - 1) * size;
  let q = db.from('orders').select('*');
  if (f.status) q = q.eq('status', f.status);
  if (f.serviceKey) q = q.eq('service_key', f.serviceKey);
  if (f.source) q = q.eq('source', f.source);
  if (f.priority) q = q.eq('priority', f.priority);
  if (f.search) q = q.ilike('code', `%${f.search}%`);
  const col = f.sort === 'deadline' ? 'deadline_at' : f.sort === 'value' ? 'value_cents' : 'created_at';
  q = q.order(col, { ascending: f.sort === 'deadline' }).range(from, from + size - 1);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getOrder(db: DB, id: string): Promise<OrderRow | null> {
  const { data, error } = await db.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Per-status counts for the summary strip. */
export async function statusCounts(db: DB): Promise<Record<string, number>> {
  const { data, error } = await db.from('orders').select('status');
  if (error) throw error;
  return (data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
}
```

- [ ] **Step 6: Run it (passes)**

Run: `pnpm --filter @heva/app test queries`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/app/src/lib/orders/queries.ts apps/app/src/lib/orders/queries.test.ts apps/app/src/test/db.ts apps/app/vitest.config.ts apps/app/vitest.setup.ts apps/app/package.json pnpm-lock.yaml
git commit -m "feat(orders): order queries + integration-test harness"
```

### Task 14: Order mutations (Tx functions)

**Files:**
- Create: `apps/app/src/lib/orders/mutations.ts`
- Test: `apps/app/src/lib/orders/mutations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/lib/orders/mutations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { testDb, makeCustomer, makeOrder } from '@/test/db';
import { confirmOrderTx, transitionOrderTx, cancelOrderTx } from './mutations';

const db = testDb();

describe('order mutations', () => {
  it('confirm deducts credit and writes audit', async () => {
    const c = await makeCustomer(db, 10000);            // $100 balance
    const o = await makeOrder(db, c, { value_cents: 3900, status: 'new' });
    await confirmOrderTx(db, o.id, null);
    const { data: order } = await db.from('orders').select('status').eq('id', o.id).single();
    expect(order!.status).toBe('confirmed');
    const { data: bal } = await db.from('customer_balances').select('balance_cents').eq('customer_id', c).single();
    expect(bal!.balance_cents).toBe(6100);              // 10000 - 3900
    const { data: log } = await db.from('audit_log').select('*').eq('entity_id', o.id);
    expect(log!.some((l) => l.to_status === 'confirmed')).toBe(true);
  });

  it('confirm blocks on insufficient credit', async () => {
    const c = await makeCustomer(db, 1000);             // $10 balance
    const o = await makeOrder(db, c, { value_cents: 3900, status: 'new' });
    await expect(confirmOrderTx(db, o.id, null)).rejects.toThrow(/insufficient/i);
    const { data: order } = await db.from('orders').select('status').eq('id', o.id).single();
    expect(order!.status).toBe('new');                  // unchanged
  });

  it('rejects an invalid transition', async () => {
    const c = await makeCustomer(db);
    const o = await makeOrder(db, c, { status: 'new' });
    await expect(transitionOrderTx(db, o.id, 'completed', null)).rejects.toThrow(/invalid transition/i);
  });

  it('cancel after confirm refunds the debit', async () => {
    const c = await makeCustomer(db, 10000);
    const o = await makeOrder(db, c, { value_cents: 3900, status: 'new' });
    await confirmOrderTx(db, o.id, null);
    await cancelOrderTx(db, o.id, 'test', null);
    const { data: bal } = await db.from('customer_balances').select('balance_cents').eq('customer_id', c).single();
    expect(bal!.balance_cents).toBe(10000);             // refunded back to full
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `pnpm --filter @heva/app test mutations`
Expected: FAIL — `mutations` module not found.

- [ ] **Step 3: Implement**

Create `apps/app/src/lib/orders/mutations.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { OrderStatus } from './types';
import { canTransition } from './state-machine';

type DB = SupabaseClient<Database>;

async function loadOrder(db: DB, id: string) {
  const { data, error } = await db.from('orders').select('*').eq('id', id).single();
  if (error || !data) throw new Error('Order not found');
  return data;
}

async function audit(db: DB, orderId: string, actorId: string | null, action: string, from?: OrderStatus, to?: OrderStatus) {
  await db.from('audit_log').insert({ actor_id: actorId, entity: 'order', entity_id: orderId, action, from_status: from, to_status: to });
}

async function balance(db: DB, customerId: string): Promise<number> {
  const { data } = await db.from('customer_balances').select('balance_cents').eq('customer_id', customerId).maybeSingle();
  return data?.balance_cents ?? 0;
}

async function setStatus(db: DB, id: string, to: OrderStatus) {
  const { error } = await db.from('orders').update({ status: to, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** New → Confirmed: check + deduct credit, then audit. */
export async function confirmOrderTx(db: DB, id: string, actorId: string | null) {
  const order = await loadOrder(db, id);
  if (!canTransition(order.status, 'confirmed')) throw new Error('Invalid transition');
  if (await balance(db, order.customer_id) < order.value_cents) throw new Error('Insufficient credit');
  await db.from('credit_ledger').insert({ customer_id: order.customer_id, order_id: id, delta_cents: -order.value_cents, reason: `Order ${order.code} confirmed` });
  await setStatus(db, id, 'confirmed');
  await audit(db, id, actorId, 'transition', order.status, 'confirmed');
}

/** Any validated transition (except confirm/cancel which have their own rules). */
export async function transitionOrderTx(db: DB, id: string, to: OrderStatus, actorId: string | null) {
  const order = await loadOrder(db, id);
  if (to === 'confirmed') return confirmOrderTx(db, id, actorId);
  if (to === 'canceled') return cancelOrderTx(db, id, 'canceled', actorId);
  if (!canTransition(order.status, to)) throw new Error('Invalid transition');
  await setStatus(db, id, to);
  await audit(db, id, actorId, 'transition', order.status, to);
  // Side effects (best-effort notifications) — own module owns the templates.
  if (to === 'assigned' && order.assigned_staff_id) {
    await db.from('notifications').insert({ recipient_id: order.assigned_staff_id, type: 'order_assigned', payload: { order_id: id } });
  }
}

export async function assignOrderTx(db: DB, id: string, staffId: string, deadlineAt: string | null, actorId: string | null) {
  const order = await loadOrder(db, id);
  await db.from('orders').update({ assigned_staff_id: staffId, deadline_at: deadlineAt }).eq('id', id);
  if (order.status === 'confirmed') await transitionOrderTx(db, id, 'assigned', actorId);
  await audit(db, id, actorId, 'assign', order.status, undefined);
}

/** Cancel (New/Confirmed only); refund credit if it was deducted. */
export async function cancelOrderTx(db: DB, id: string, reason: string, actorId: string | null) {
  const order = await loadOrder(db, id);
  if (!['new', 'confirmed'].includes(order.status)) throw new Error('Invalid transition');
  if (order.status === 'confirmed') {
    await db.from('credit_ledger').insert({ customer_id: order.customer_id, order_id: id, delta_cents: order.value_cents, reason: `Order ${order.code} canceled — refund` });
  }
  await setStatus(db, id, 'canceled');
  await audit(db, id, actorId, 'cancel', order.status, 'canceled');
}
```

- [ ] **Step 4: Run it (passes)**

Run: `pnpm --filter @heva/app test mutations`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/orders/mutations.ts apps/app/src/lib/orders/mutations.test.ts
git commit -m "feat(orders): order mutations (confirm/transition/assign/cancel) with credit + audit"
```

### Task 15: Server Action wrappers + RLS check

**Files:**
- Create: `apps/app/src/app/admin/orders/actions.ts`
- Test: `apps/app/src/lib/supabase/rls.test.ts`

- [ ] **Step 1: Action wrappers**

Create `apps/app/src/app/admin/orders/actions.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { confirmOrderTx, transitionOrderTx, assignOrderTx, cancelOrderTx } from '@/lib/orders/mutations';
import type { OrderStatus } from '@/lib/orders/types';

async function ctx() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { db, actorId: user.id };
}

export async function confirmOrder(id: string) {
  const { db, actorId } = await ctx();
  await confirmOrderTx(db, id, actorId);
  revalidatePath('/admin/orders');
}
export async function transitionOrder(id: string, to: OrderStatus) {
  const { db, actorId } = await ctx();
  await transitionOrderTx(db, id, to, actorId);
  revalidatePath('/admin/orders');
}
export async function assignOrder(id: string, staffId: string, deadlineAt: string | null) {
  const { db, actorId } = await ctx();
  await assignOrderTx(db, id, staffId, deadlineAt, actorId);
  revalidatePath('/admin/orders');
}
export async function cancelOrder(id: string, reason: string) {
  const { db, actorId } = await ctx();
  await cancelOrderTx(db, id, reason, actorId);
  revalidatePath('/admin/orders');
}
```

- [ ] **Step 2: Write the RLS test (anon cannot read orders)**

Create `apps/app/src/lib/supabase/rls.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Anon client (no auth) must be blocked by RLS from reading orders.
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

describe('RLS', () => {
  it('blocks anonymous reads of orders', async () => {
    const { data } = await anon.from('orders').select('*');
    expect(data ?? []).toHaveLength(0); // RLS returns no rows for unauthenticated
  });
});
```

- [ ] **Step 3: Run it (passes)**

Run: `pnpm --filter @heva/app test rls`
Expected: PASS — anon sees 0 rows (RLS active).

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/app/admin/orders/actions.ts apps/app/src/lib/supabase/rls.test.ts
git commit -m "feat(orders): server action wrappers + RLS verification"
```

---

## Phase 3 — UI

### Task 16: Orders list page (server) + filters + status strip

**Files:**
- Create: `apps/app/src/app/admin/orders/filters.ts`, `apps/app/src/app/admin/orders/StatusStrip.tsx`, `apps/app/src/app/admin/orders/page.tsx`
- Test: `apps/app/src/app/admin/orders/filters.test.ts`

- [ ] **Step 1: Write the failing filters test**

Create `apps/app/src/app/admin/orders/filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseFilters } from './filters';

describe('parseFilters', () => {
  it('reads known params and ignores junk', () => {
    const f = parseFilters({ status: 'new', source: 'quick', page: '2', bogus: 'x' });
    expect(f).toEqual({ status: 'new', source: 'quick', page: 2 });
  });
  it('drops invalid enum values', () => {
    expect(parseFilters({ status: 'nope' })).toEqual({});
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `pnpm --filter @heva/app test filters`
Expected: FAIL.

- [ ] **Step 3: Implement filters**

Create `apps/app/src/app/admin/orders/filters.ts`:

```ts
import type { OrderFilters } from '@/lib/orders/queries';

const STATUSES = ['new','confirmed','assigned','in_progress','internal_review','delivered','changes_requested','approved','completed','canceled'];
const SOURCES = ['quick', 'dashboard'];
const PRIORITIES = ['low', 'med', 'high'];
const SORTS = ['created', 'deadline', 'value'];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFilters(params: Params): OrderFilters {
  const f: OrderFilters = {};
  const status = one(params.status); if (status && STATUSES.includes(status)) f.status = status as OrderFilters['status'];
  const source = one(params.source); if (source && SOURCES.includes(source)) f.source = source as OrderFilters['source'];
  const priority = one(params.priority); if (priority && PRIORITIES.includes(priority)) f.priority = priority as OrderFilters['priority'];
  const sort = one(params.sort); if (sort && SORTS.includes(sort)) f.sort = sort as OrderFilters['sort'];
  const serviceKey = one(params.serviceKey); if (serviceKey) f.serviceKey = serviceKey;
  const search = one(params.search); if (search) f.search = search;
  const page = Number(one(params.page)); if (Number.isInteger(page) && page > 1) f.page = page;
  return f;
}

export function toQuery(f: OrderFilters): string {
  const sp = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v != null && v !== '') sp.set(k, String(v)); });
  const s = sp.toString();
  return s ? `?${s}` : '';
}
```

- [ ] **Step 4: Run it (passes)**

Run: `pnpm --filter @heva/app test filters`
Expected: PASS (2 tests).

- [ ] **Step 5: Status strip (client)**

Create `apps/app/src/app/admin/orders/StatusStrip.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { toQuery } from './filters';

const ORDER = ['new','confirmed','assigned','in_progress','internal_review','delivered','approved','completed'] as const;
const LABEL: Record<string, string> = { new: 'New', confirmed: 'Confirmed', assigned: 'Assigned', in_progress: 'In progress', internal_review: 'Internal review', delivered: 'Delivered', approved: 'Approved', completed: 'Completed' };

export function StatusStrip({ counts, active }: { counts: Record<string, number>; active?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((s) => (
        <Link key={s} href={`/admin/orders${active === s ? '' : toQuery({ status: s as never })}`}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>
          {LABEL[s]} <span className="ml-1 opacity-70">{counts[s] ?? 0}</span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Orders page (server)**

Create `apps/app/src/app/admin/orders/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { listOrders, statusCounts } from '@/lib/orders/queries';
import { parseFilters } from './filters';
import { StatusStrip } from './StatusStrip';
import { OrdersTable } from './OrdersTable';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const filters = parseFilters(await searchParams);
  const db = await createClient();
  const [orders, counts] = await Promise.all([listOrders(db, filters), statusCounts(db)]);
  return (
    <section className="space-y-4">
      <h1 className="display text-2xl font-bold">Orders</h1>
      <StatusStrip counts={counts} active={filters.status} />
      <OrdersTable initialOrders={orders} />
    </section>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/app/src/app/admin/orders/filters.ts apps/app/src/app/admin/orders/filters.test.ts apps/app/src/app/admin/orders/StatusStrip.tsx apps/app/src/app/admin/orders/page.tsx
git commit -m "feat(admin): orders page (server) + filters + status strip"
```

### Task 17: Orders table (client) — live + bulk

**Files:**
- Create: `apps/app/src/app/admin/orders/OrdersTable.tsx`

- [ ] **Step 1: Implement the table**

Create `apps/app/src/app/admin/orders/OrdersTable.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabase/client';
import { listOrders, type OrderRow } from '@/lib/orders/queries';
import { transitionOrder, cancelOrder } from './actions';

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function OrdersTable({ initialOrders }: { initialOrders: OrderRow[] }) {
  const router = useRouter();
  const qc = useQueryClient();
  const sb = supabaseBrowser();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => listOrders(sb, {}),
    initialData: initialOrders,
  });

  // Realtime: any change to orders refetches the list.
  useEffect(() => {
    const ch = sb.channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
        () => qc.invalidateQueries({ queryKey: ['orders'] }))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, qc]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function bulkCancel() {
    await Promise.all([...selected].map((id) => cancelOrder(id, 'bulk cancel')));
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ['orders'] });
  }

  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>{selected.size} selected</span>
          <button onClick={bulkCancel} className="rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-white">Cancel</button>
        </div>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="w-8 p-2"></th>
            <th className="p-2">Code</th><th className="p-2">Service</th><th className="p-2">Status</th>
            <th className="p-2">Priority</th><th className="p-2 text-right">Value</th><th className="p-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="cursor-pointer border-b border-border/60 hover:bg-muted/40" onClick={() => router.push(`/admin/orders/${o.id}`)}>
              <td className="p-2" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
              </td>
              <td className="p-2 font-medium">{o.code}</td>
              <td className="p-2">{o.service_key}{o.package_id ? ` · ${o.package_id}` : ''}</td>
              <td className="p-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{o.status}</span></td>
              <td className="p-2">{o.priority}</td>
              <td className="p-2 text-right">{money(o.value_cents)}</td>
              <td className="p-2 text-xs text-muted-foreground">{o.source}</td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No orders match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

With dev server + Supabase running and signed in, visit `/admin/orders`.
Expected: seeded orders (AUD-1001, KW-1002) render; clicking a status chip filters; selecting rows shows the bulk bar.

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/app/admin/orders/OrdersTable.tsx
git commit -m "feat(admin): live orders table with realtime + bulk cancel"
```

### Task 18: Order detail + transition controls

**Files:**
- Create: `apps/app/src/app/admin/orders/[id]/TransitionButtons.tsx`, `apps/app/src/app/admin/orders/[id]/page.tsx`

- [ ] **Step 1: Transition buttons (client)**

Create `apps/app/src/app/admin/orders/[id]/TransitionButtons.tsx`:

```tsx
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { nextStates } from '@/lib/orders/state-machine';
import type { OrderStatus } from '@/lib/orders/types';
import { transitionOrder } from '../actions';

const LABEL: Record<string, string> = { confirmed: 'Confirm', assigned: 'Mark assigned', in_progress: 'Start work', internal_review: 'Internal review', delivered: 'Deliver', approved: 'Approve', changes_requested: 'Request changes', completed: 'Complete', canceled: 'Cancel' };

export function TransitionButtons({ id, status }: { id: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const targets = nextStates(status);
  if (targets.length === 0) return <span className="text-sm text-muted-foreground">No further actions.</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((to) => (
        <button key={to} disabled={pending}
          onClick={() => start(async () => { await transitionOrder(id, to); router.refresh(); })}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {LABEL[to] ?? to}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Detail page (server)**

Create `apps/app/src/app/admin/orders/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOrder } from '@/lib/orders/queries';
import { TransitionButtons } from './TransitionButtons';

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const order = await getOrder(db, id);
  if (!order) notFound();
  const { data: customer } = await db.from('customers').select('name, email, company').eq('id', order.customer_id).single();
  const { data: timeline } = await db.from('audit_log').select('*').eq('entity_id', id).order('at', { ascending: false });

  return (
    <section className="max-w-3xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl font-bold">{order.code}</h1>
          <p className="text-sm text-muted-foreground">{order.service_key}{order.package_id ? ` · ${order.package_id}` : ''} · {money(order.value_cents)} · {order.source}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">{order.status}</span>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Actions</p>
        <TransitionButtons id={order.id} status={order.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Customer</p>
          <p className="text-sm">{customer?.name} · {customer?.email}</p>
          {customer?.company && <p className="text-xs text-muted-foreground">{customer.company}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Brief</p>
          <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(order.brief, null, 2)}</pre>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Activity</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {(timeline ?? []).map((t) => (
            <li key={t.id}>{new Date(t.at).toLocaleString()} — {t.action}{t.from_status ? ` ${t.from_status}→${t.to_status}` : ''}</li>
          ))}
          {(timeline ?? []).length === 0 && <li>No activity yet.</li>}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify**

Visit `/admin/orders`, click AUD-1001 → detail renders; click **Confirm** → status becomes `confirmed`, an Activity row appears, customer balance drops (check via `/admin` later or DB).

- [ ] **Step 4: Commit**

```bash
git add "apps/app/src/app/admin/orders/[id]"
git commit -m "feat(admin): order detail page + state-machine transition controls"
```

---

## Phase 4 — E2E

### Task 19: Playwright happy path

**Files:**
- Modify: `apps/app/package.json` (playwright + script)
- Create: `apps/app/playwright.config.ts`, `apps/app/e2e/orders.spec.ts`

- [ ] **Step 1: Install Playwright**

Run: `pnpm --filter @heva/app add -D @playwright/test && pnpm --filter @heva/app exec playwright install chromium`

- [ ] **Step 2: Config**

Create `apps/app/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4400' },
  webServer: { command: 'pnpm dev', port: 4400, reuseExistingServer: true },
});
```

Add to `apps/app/package.json` scripts: `"e2e": "playwright test"`.

- [ ] **Step 3: Happy-path spec**

Create `apps/app/e2e/orders.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('admin signs in and confirms an order', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name=email]', 'admin@hevaseo.com');
  await page.fill('input[name=password]', 'changeme123');
  await page.click('button[type=submit]');

  await expect(page).toHaveURL(/\/admin\/orders/);
  await expect(page.getByText('AUD-1001')).toBeVisible();

  await page.getByText('AUD-1001').click();
  await expect(page.getByRole('heading', { name: 'AUD-1001' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('confirmed')).toBeVisible();
});
```

- [ ] **Step 4: Run it**

Prereqs: `supabase start` running, DB reset + seeded + admin created.
Run: `pnpm --filter @heva/app e2e`
Expected: PASS — signs in, confirms AUD-1001.

- [ ] **Step 5: Commit**

```bash
git add apps/app/playwright.config.ts apps/app/e2e apps/app/package.json pnpm-lock.yaml
git commit -m "test(admin): playwright e2e — sign in + confirm order"
```

---

## Self-Review

- **Spec coverage:** table view (T16–17) · status strip/intake (T16) · order detail (T18) · state machine + enforcement (T9, T14, T18) · `orders`/`audit_log` model (T3) · value snapshot server-side (T10) · credit deduct at Confirm (T14) · cancel refund (T14) · Realtime live table (T17) · URL filters (T16) · RLS (T4, T15) · unit/integration/E2E tests (all phases). ✓
- **Foundation bundled:** Supabase (T2–T3), RLS (T4), clients (T5), auth (T6), shell (T7), seed (T8). ✓
- **Deferred (other modules, stubbed):** assignment UX (assignOrderTx exists; staff picker is module 3), deliverable review UI (module 4), messaging (module 10), finance ledger rules (module 9 — hook here). Detail page shows brief + activity; staff/deliverable/messages panels are added by their modules.

