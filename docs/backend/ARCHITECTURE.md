# HevaSEO Backend — Architecture Reference

Concrete guide for where backend code lives, how Supabase clients are configured, how the
request path flows from page to database, and what conventions apply at every boundary.
Read this before writing any query module, Server Action, or migration.

---

## 1. Directory Layout

The backend has no separate service. All server-side code lives inside the Next.js app at
`apps/app/`. The only exception is `supabase/` at the repo root, which holds Supabase CLI
config, migrations, and the seed script.

```
hevaseo-platform/
├─ supabase/                          ← Supabase CLI project root
│  ├─ config.toml                     ← local dev config (port, Auth settings, Storage)
│  ├─ migrations/                     ← versioned SQL applied in order
│  │  ├─ 20240701000000_enums.sql
│  │  ├─ 20240701000001_identity.sql
│  │  ├─ 20240701000002_catalog.sql
│  │  └─ …                            ← one file per domain migration
│  └─ seed.sql                        ← deterministic seed used for local dev + CI
│
└─ apps/app/src/
   ├─ lib/
   │  └─ supabase/
   │     ├─ server.ts                 ← createClient() for RSC and Server Actions (§3.1)
   │     ├─ client.ts                 ← createBrowserClient() for Client Components (§3.2)
   │     └─ service.ts                ← createServiceClient() for service-role jobs (§3.3)
   ├─ server/
   │  ├─ queries/                     ← read-only query modules; import 'server-only'
   │  │  ├─ orders.ts                 ← buildOrderDetailProps, customerSignals, …
   │  │  ├─ staff.ts                  ← currentStaffId, currentStaffIdentity, buildStaffInsight, …
   │  │  ├─ finance.ts                ← staffPaySeed, buildPayrollPeriods, currentPenalties, …
   │  │  ├─ affiliate.ts              ← portalDataFor, currentAffiliateId, …
   │  │  ├─ manager.ts                ← managerScope, buildManagerPerf, allManagerPerf, …
   │  │  ├─ docs.ts                   ← docsForStaff, docsForManager, docsForCustomer, …
   │  │  ├─ broadcasts.ts             ← broadcastsForAudience, broadcastReceipt, unreadCount
   │  │  └─ customers.ts              ← customerSignals, resolveCustomerId
   │  └─ actions/                     ← Next.js Server Actions ('use server'); mutations
   │     ├─ orders.ts                 ← placeOrder, transitionOrderStatus, assignOrder, …
   │     ├─ deliverables.ts           ← submitDeliverable, reviewDeliverable, uploadDeliverable
   │     ├─ finance.ts                ← setPayOverride, requestStaffPayout, runPayrollForPeriod, …
   │     ├─ affiliate.ts              ← applyAsAffiliate, requestAffiliatePayout, …
   │     ├─ broadcasts.ts             ← sendBroadcast, recallBroadcast, markBroadcastRead, …
   │     ├─ docs.ts                   ← publishDoc, updateDoc, deleteDoc
   │     ├─ notes.ts                  ← createNote, updateNote, deleteNote
   │     └─ tickets.ts                ← raiseTicket, replyToTicket, resolveTicket, …
   ├─ lib/                            ← pure business logic (unchanged from Phase-0)
   │  ├─ errors.ts                    ← DataAccessError class (§6)
   │  └─ … (rbac.ts, staffFinance.ts, managerPulse.ts, etc.)
   └─ data/                           ← Phase-0 mock constants; removed domain by domain
```

### Key rule

`server/queries/*` and `server/actions/*` are server-only modules. Add `import 'server-only'`
at the top of every file in these directories. Next.js will throw a build error if a Client
Component imports from them.

---

## 2. Supabase Client Modules

Three clients; one purpose each. Never use the wrong client for the wrong context.

### 2.1 `lib/supabase/server.ts` — authenticated client for RSC and Server Actions

Used by **every read query and mutation that runs in a user's session**. Reads the user's JWT
from the Next.js cookie store and passes it to Supabase so RLS applies automatically.

```typescript
// apps/app/src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';  // generated types

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:    () => cookieStore.getAll(),
        setAll: (pairs) => pairs.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  );
}
```

This client is async because `cookies()` is async in Next.js 15. Call `await createClient()`
at the top of every query function or Server Action.

### 2.2 `lib/supabase/client.ts` — browser client for Client Components

Used only for real-time subscriptions and browser-initiated auth flows (e.g., OTP magic-link
sign-in). Does **not** appear in any query module. RLS still applies because the user's JWT
is sent with every request.

```typescript
// apps/app/src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 2.3 `lib/supabase/service.ts` — service-role client (RLS bypassed)

Used **only** for operations that legitimately need to cross user boundaries:

- `supabase/seed.sql` and migration scripts
- Background / cron jobs (nightly payroll compute, commission clearing)
- Admin Server Actions that must write across multiple users' rows (e.g., `runPayrollForPeriod`)
- Edge Functions that mint impersonation tokens
- The affiliate join form (public INSERT into `affiliates` before auth exists)

```typescript
// apps/app/src/lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export function createServiceClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,           // NOT NEXT_PUBLIC_ — server env only
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**The service-role invariant:** the service-role client bypasses RLS. Any query it runs
must be preceded by Zod validation of all client-supplied input. An injection in a service-role
query has unrestricted write access to every table.

> **Implemented** (`apps/app/src/lib/supabase/service.ts`, `import 'server-only'`): live callers are the **top-up server action** (`topUpAction` → `topup` fn + invoice), the **create-order action** (`placeOrderAction` → `create_order`), and the **public marketing checkout** (`POST /api/public/checkout` → provision account + `materialize_order`). All compute the money value server-side (never trusting the client) before calling the service-role-only DB fns. Reads the key from `SUPABASE_SERVICE_ROLE_KEY` (server-only env). See FEATURES §2.16 / §4.6.

---

## 3. Environment Variables and Secrets

| Variable | Scope | Purpose | Never in client? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (both) | PostgREST + Auth endpoint | No — intentionally public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (both) | Anon JWT (RLS still applies) | No — intentionally public |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Bypasses RLS; unrestricted DB | **Yes — never in `NEXT_PUBLIC_*`** |
| `SUPABASE_URL` | Server only | Used by `service.ts` | Yes |

### Startup validation

Validate presence of required env vars at server startup so failures surface immediately
rather than at the first authenticated request:

```typescript
// apps/app/src/lib/env.ts  (imported by lib/supabase/server.ts and service.ts)
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}
```

`SUPABASE_SERVICE_ROLE_KEY` must live in Vercel's "server" environment scope (not "preview"
unless you also want it there) and in `.env.local` locally. It must **never** appear in a
`NEXT_PUBLIC_*` variable or be logged.

---

## 4. The Request Path

### 4.1 Read path (Server Component)

```
Browser GET /admin/orders
  → Next.js renders Server Component (page.tsx)
  → calls server/queries/orders.ts::buildOrderListProps()
      → createClient()       // reads JWT from cookie
      → supabase.from('orders').select(…)
      //  RLS: orders_admin_all / orders_manager_select / orders_staff_select policies run
      //  Manager sees only pod orders; staff sees only own orders
      → maps rows to OrderListProps (same shape mock returned)
  → returns OrderListProps to page.tsx
  → page.tsx renders <OrdersClient orders={…} />
Browser receives HTML + hydration payload
```

No manual role checks in the query function. RLS decides which rows come back.

### 4.2 Write path (Server Action)

```
User clicks "Cancel Order"
  → Client Component calls cancelOrder({ orderId }) [Server Action]
  → Server Action (server/actions/orders.ts):
      1. Input.parse(raw)          // Zod — throws if invalid; never trust client input
      2. createClient()            // authenticated client
      3. supabase.auth.getUser()   // confirm user is authenticated
      4. supabase.from('orders').update({ status: 'canceled' }).eq('id', orderId)
         // RLS: orders_admin_all or orders_manager_update policy runs
         // If the user is staff or customer, no WITH CHECK policy matches → error
      5. audit_events INSERT       // emit audit row for every state change
      6. revalidatePath('/admin/orders')   // bust RSC cache
```

Money mutations (payroll, payouts, credit adjustments) follow the same pattern but
additionally wrap the DB writes in a Postgres transaction via `supabase.rpc('run_in_tx', …)`
or a stored procedure.

### 4.3 Manager money-blind path

Manager clients query **views**, not the base tables that carry money columns:

| What the manager wants | Client queries | What it returns |
|---|---|---|
| Order list/detail | `orders_manager` view | All order columns except `value` (NULL) |
| Customer list/detail | `customers_manager` view | All columns except `spend`, `balance` (NULL) |
| Package pricing | `catalog_packages_public` view | All columns except `gig_rate` (stripped) |

Server Actions that serve manager pages select the right view based on the caller's role
read from `supabase.auth.getUser()`. The base tables have no manager SELECT policy on money
columns — even if the view were bypassed at the app layer, RLS on the base table allows
the read but does not redact; the view is the column-redaction layer.

### 4.4 Service-role path (background jobs)

```
Vercel Cron → Edge Function → createServiceClient()
  → runPayrollForPeriod({ month: '2026-06' })
      1. Zod.parse(input)
      2. BEGIN transaction
      3. Compute payroll for each staff member
         (payroll_records upsert + payroll_gig_counts rows)
      4. COMMIT
      5. audit_events INSERT (via service-role, not RLS-gated)
```

The service-role client is never used in a code path reachable from a browser fetch.

---

## 5. Error Handling and Response Envelope

### 5.1 `DataAccessError`

All unexpected DB errors (connection failure, constraint violation, unexpected null) are
wrapped in a typed error class. Query functions never throw raw `PostgrestError`:

```typescript
// apps/app/src/lib/errors.ts
export class DataAccessError extends Error {
  constructor(
    public readonly context: string,   // e.g. 'orders.buildDetail'
    public readonly cause: unknown
  ) {
    super(`DB error in ${context}`);
    this.name = 'DataAccessError';
  }
}
```

**Return contract for query functions:**
- Return `null` when a row is not found (triggers `notFound()` at the page level).
- Throw `DataAccessError` for unexpected errors (caught by the nearest React error boundary
  and rendered as a proper error page).
- Never surface Postgres error messages to the client; log the cause server-side only.

```typescript
// Pattern used in every query function:
const { data, error } = await supabase.from('orders').select('…').eq('id', id).single();
if (error?.code === 'PGRST116') return null;   // not found
if (error) throw new DataAccessError('orders.buildDetail', error);
```

### 5.2 Server Action result shape

Server Actions that need to communicate a validation or business-logic error back to the
client return a consistent result envelope instead of throwing:

```typescript
export type ActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };
```

Throwing from a Server Action is reserved for unexpected infrastructure failures (the Next.js
error boundary catches them). Expected validation and domain errors (e.g., "payout amount
exceeds available balance") return `{ ok: false, error: '…' }` so the client can display a
toast without an error page.

### 5.3 Zod at every boundary

Every Server Action and Route Handler parses all external input with Zod before the input
touches the DB. Never use `as SomeType` to cast untrusted input:

```typescript
// apps/app/src/server/actions/orders.ts
'use server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DataAccessError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';

const TransitionInput = z.object({
  orderId: z.string().min(1),
  status:  z.enum(['confirmed','assigned','in_progress','internal_review',
                   'delivered','changes_requested','approved','completed','canceled']),
});

export async function transitionOrderStatus(raw: unknown): Promise<ActionResult> {
  const parsed = TransitionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { orderId, status } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) throw new DataAccessError('orders.transition', error);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
  return { ok: true, data: undefined };
}
```

---

## 6. RLS as the Authorization Layer

RLS is the deepest and authoritative gate. The application layer does **not** perform
manual role checks in query functions:

```typescript
// WRONG: app-layer role guard in a query function
if (userRole !== 'admin') throw new Error('Forbidden');
await supabase.from('payroll_records').select('…');

// CORRECT: just run the query; RLS decides
await supabase.from('payroll_records').select('…');
// Admin → rows returned.  Manager / staff / customer → 0 rows (silent filter by RLS).
```

The one exception is **service-role paths**, where the caller is a background job rather than
a user session. There, explicit code-level guards take the place of RLS (because the
service-role bypasses it), and Zod validation is mandatory before every write.

**The three JWT helper functions** (`current_heva_role()`, `current_pod()`,
`current_entity_id()`) are the only way RLS policies read JWT claims. They are
`SECURITY DEFINER` functions in the `public` schema. All policy predicates reference them —
no policy reads `auth.jwt()` directly. See `RLS.md §1.3` for the definitions.

**Money-blind via views (not policies):** RLS cannot redact individual columns. The
`orders_manager`, `customers_manager`, and `catalog_packages_public` views are the
column-redaction layer. Manager Supabase clients must query these views. See `RLS.md §2.1`.

---

## 7. Migration Workflow

```
supabase/migrations/YYYYMMDDHHMMSS_<domain>.sql
```

Rules:
- One migration file per domain or schema change.
- Every migration must be reversible: include `-- DOWN` comments or a companion
  `_rollback.sql` for destructive changes.
- Apply locally: `supabase db reset` (wipes + replays all migrations + seed).
- Apply in CI: `supabase db push` against the target project.
- Never modify an already-committed migration; create a new migration to fix it.

Migration order for Phase B1 (run in this dependency sequence):

1. `enums.sql` — all `CREATE TYPE … AS ENUM` declarations
2. `identity.sql` — `users`, `managers`, `staff` (note: `staff` references `managers`)
3. `customers.sql` — `customers` (references `affiliates` via FK; add FK in a later migration)
4. `catalog.sql` — `catalog_services`, `catalog_packages`, `catalog_groups`, `catalog_addons`
5. `orders.sql` — `orders`, `order_brief_fields`, `order_addons`, `order_bundle`
6. `deliverables.sql` — `deliverables`
7. `tickets.sql` — `tickets`, `ticket_messages`
8. `finance.sql` — `transactions`, `invoices`, `invoice_orders`
9. `payroll.sql` — `pay_overrides`, `pay_presets`, `payroll_records`, `payroll_gig_counts`,
    `manager_payroll_records`, `staff_penalties`, `staff_wallet_entries`, `staff_payout_methods`,
    `staff_payout_requests`
10. `affiliate.sql` — `affiliates`, `affiliate_referrals`, `commission_events`,
    `affiliate_payout_requests`, `program_rules`, `affiliate_tier_config`, `marketing_assets`
11. `messaging.sql` — `broadcasts`, `broadcast_audiences`, `broadcast_receipts`
12. `docs.sql` — `docs`, `doc_audiences`, `doc_resources`
13. `notes.sql` — `notes`, `note_attachments`
14. `notifications.sql` — `notifications`
15. `audit.sql` — `audit_events`, `audit_diffs`
16. `settings.sql` — `settings_sla`, `settings_routing`, `settings_scoring`, `email_templates`,
    `integrations`
17. `staff_schedule.sql` — `staff_availability`, `staff_work_hours`, `leave_requests`,
    `assignment_rules`
18. `rls.sql` — `ENABLE ROW LEVEL SECURITY` + all policies from `RLS.md §3`
19. `triggers.sql` — `moddatetime`, `updated_at`, audit trigger template, customer tier trigger

---

## 8. Deployment Shape

| Layer | Service | Notes |
|---|---|---|
| Frontend + API | Vercel | Next.js 15; all Server Actions and Route Handlers are Vercel Functions |
| Database | Supabase (Postgres) | Managed; migrations applied via `supabase db push` in CI |
| Auth | Supabase Auth | Email + OTP; JWT custom claims via `auth.custom_access_token_hook` |
| Storage | Supabase Storage | Deliverable files; attachments in `note_attachments` |
| Background jobs | Vercel Cron → Edge Functions | Nightly payroll, commission clearing, commission status aging |

### Per-environment env vars

| Environment | `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_SERVICE_ROLE_KEY` |
|---|---|---|
| Local dev | `http://localhost:54321` | local project service key |
| Preview (Vercel) | staging project URL | staging service key |
| Production (Vercel) | prod project URL | prod service key |

Rotate keys immediately if they appear in logs, error traces, or client-visible responses.

---

## 9. Type Generation

Supabase CLI generates TypeScript types from the schema. Run after every migration:

```bash
supabase gen types typescript --local > apps/app/src/types/supabase.ts
```

Import `Database` from this file in all three Supabase client modules so query results are
typed from the schema, not from hand-written interfaces.

---

## 10. The Mock → DB Cutover Pattern (summary)

Full detail is in `DATA-ACCESS.md`. The architectural summary:

1. Each `lib/` or `data/` builder function keeps its **exact exported name, parameter
   signature, and return shape** when cut over from mock to DB.
2. The mock body is replaced with a call to the corresponding `server/queries/*` function.
3. A page does not change when its domain is cut over — only the data source changes.
4. Unconverted domains keep using mock data in the same build; mixing is intentional and safe.
5. Pure math functions (`effectivePay`, `buildLedger`, `tierFor`, etc.) stay in `lib/` and are
   never moved to `server/` — they receive DB-fetched data as arguments, not queries.
