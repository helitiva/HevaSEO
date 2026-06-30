# HevaSEO — Row-Level Security (RLS)

RLS is the **source of truth** for access control. The UI layer (`lib/rbac.ts`, `lib/managerScope.ts`,
`lib/viewer.tsx`) is a consistency mirror; the database is the hard gate. Every `Capability` in
`rbac.ts` maps to one or more policies below. A row a user cannot read should never appear in
a query result, regardless of what the application layer does.

---

## 1. Auth & JWT Claims

### 1.1 Supabase Auth Setup

Use Supabase Auth (email + OTP). On sign-in Supabase issues a signed JWT. We extend that JWT
with custom claims via a Postgres function that Supabase calls during token minting:

```sql
-- In the auth schema (Supabase hook: customize_access_token)
CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  claims  jsonb;
  u_role  text;
  u_pod   text;
  u_eid   text;
BEGIN
  claims := event -> 'claims';

  -- Look up role from our users table
  SELECT role::text INTO u_role
  FROM public.users
  WHERE id = (event ->> 'user_id')::uuid;

  claims := jsonb_set(claims, '{role}', to_jsonb(u_role));

  -- Pod id (only meaningful for manager / staff)
  CASE u_role
    WHEN 'manager' THEN
      SELECT id INTO u_eid FROM public.managers WHERE user_id = (event ->> 'user_id')::uuid;
      claims := jsonb_set(claims, '{entity_id}', to_jsonb(u_eid));
      -- manager's own id IS the pod id
      claims := jsonb_set(claims, '{pod_id}', to_jsonb(u_eid));
    WHEN 'staff' THEN
      SELECT s.id, s.manager_id INTO u_eid, u_pod
      FROM public.staff s WHERE s.user_id = (event ->> 'user_id')::uuid;
      claims := jsonb_set(claims, '{entity_id}', to_jsonb(u_eid));
      claims := jsonb_set(claims, '{pod_id}',    to_jsonb(u_pod));
    WHEN 'customer' THEN
      SELECT id INTO u_eid FROM public.customers WHERE user_id = (event ->> 'user_id')::uuid;
      claims := jsonb_set(claims, '{entity_id}', to_jsonb(u_eid));
    WHEN 'affiliate' THEN
      SELECT id INTO u_eid FROM public.affiliates WHERE user_id = (event ->> 'user_id')::uuid;
      claims := jsonb_set(claims, '{entity_id}', to_jsonb(u_eid));
    ELSE
      NULL; -- admin: no entity_id / pod_id needed
  END CASE;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

Register the function as the **Customize Access Token** hook in the Supabase dashboard
(Authentication → Hooks → Customize Access Token).

### 1.2 JWT Claim Shape

Every authenticated JWT carries these custom claims under `app_metadata`:

| Claim | Type | Roles that carry it | Example |
|---|---|---|---|
| `role` | text | all | `"manager"` |
| `entity_id` | text | manager, staff, customer, affiliate | `"mgr1"` / `"s3"` / `"c4"` / `"af-jane"` |
| `pod_id` | text | manager, staff | `"mgr1"` (manager self) / `"mgr1"` (staff's manager) |

Admin users carry `role = "admin"` and no `entity_id` or `pod_id`.

### 1.3 SQL Helper Functions

These three SECURITY DEFINER functions are the only way policies read the JWT. Centralising here
means a claim rename only needs a change in one place.

```sql
-- Returns the caller's role claim, e.g. 'admin', 'manager', 'staff', 'customer', 'affiliate'
CREATE OR REPLACE FUNCTION public.current_heva_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT coalesce(auth.jwt() ->> 'role', '');
$$;

-- Returns the caller's pod_id claim (manager_id for both managers and their staff).
-- NULL for admin / customer / affiliate.
CREATE OR REPLACE FUNCTION public.current_pod()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT auth.jwt() ->> 'pod_id';
$$;

-- Returns the caller's entity_id claim.
-- For managers: manager row id.  For staff: staff row id.
-- For customers: customer row id.  For affiliates: affiliate row id.
CREATE OR REPLACE FUNCTION public.current_entity_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT auth.jwt() ->> 'entity_id';
$$;
```

Grant execute to `authenticated`:
```sql
GRANT EXECUTE ON FUNCTION public.current_heva_role()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_pod()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_entity_id()   TO authenticated;
```

> **anon role:** No table has an RLS policy for `anon`. The catalog is public but served
> through a service-role server route, not by exposing the table to the anon key.

---

## 2. Hard Cases — Read These First

### 2.1 Manager Money-Blind (column-level problem)

RLS is row-level. It cannot hide individual columns from a role that has a SELECT policy on the
table. Managers need to see orders (to manage them) but must not see `value`, `spend`, `balance`,
`base`, `commission`, `bonus`, `due`, etc.

**Chosen approach: finance tables get no manager policy; ops tables get money-redacting VIEWs.**

Concretely:

- **Finance tables** (`payroll_records`, `manager_payroll_records`, `transactions`, `invoices`,
  `staff_payout_requests`, `staff_payout_methods`, `staff_penalties`) — manager has **zero**
  SELECT policy. Queries from manager clients must never touch these tables directly. The
  service-role routes that serve admin finance pages are the only callers.

> **Implemented:** `invoices` + `order_addons` follow this money-blind rule (admin tenant + owning customer only; manager/staff → 0 rows; pgTAP `0260`/`0270`). The money-in DB fns `create_order` / `topup` / `materialize_order` are **service-role-only** (execute revoked from `anon`/`authenticated`); their only callers are the dashboard server actions and the public checkout route (`POST /api/public/checkout`). `service_role` also got explicit `grant`s where it writes directly (order_details/order_addons INSERT, invoices SELECT+INSERT, profiles SELECT, customers SELECT/INSERT/UPDATE) — see migrations `20260630130000`–`170000`.

- **Ops tables that carry a money column** (`orders.value`, `customers.spend`, `customers.balance`,
  `catalog_packages.price`, `catalog_packages.gig_rate`) — the manager's Supabase client queries a
  money-redacted VIEW instead of the base table:

```sql
-- orders — manager clients query this view, never the base table
CREATE OR REPLACE VIEW public.orders_manager AS
SELECT
  id, code, customer_id, service_id, pkg,
  NULL::numeric AS value,          -- redacted
  status, priority, source, staff_id, deadline,
  created_at, assigned_at, project_id, folder_id, note
FROM public.orders;

-- customers — manager clients query this view
CREATE OR REPLACE VIEW public.customers_manager AS
SELECT
  id, user_id, name, company, email, status, tier,
  NULL::numeric AS spend,          -- redacted
  NULL::numeric AS balance,        -- redacted
  phone, timezone, member_since, tags, referrer_id, last_active
FROM public.customers;
```

Apply RLS to the views via their underlying tables (Postgres 15+: `WITH (security_invoker = true)`)
or wrap them in SECURITY DEFINER functions. The manager's Supabase client uses the view names;
the admin client uses the base tables. Server Actions choose which to query based on the caller's
role extracted from the session.

> **Why not column grants?** `GRANT SELECT (col, ...)` works, but it requires that the role
> connecting is a distinct DB role, not just a JWT claim. Supabase uses a single `authenticated`
> Postgres role for all JWT holders; column-level grants cannot distinguish manager from admin
> at the Postgres level. Views are the correct solution.

### 2.2 Pod-Scope

A manager may only see rows that belong to their pod. A staffer's pod is their `manager_id`.
A customer is in the pod when at least one of their orders is assigned to a pod staff member.

The pod-scope predicate for orders is:
```sql
staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
OR staff_id IS NULL  -- unassigned orders: any manager can see & route
```

The pod-scope predicate for customers is:
```sql
id IN (
  SELECT DISTINCT customer_id FROM orders
  WHERE staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
)
```

For tickets, a ticket is in-pod when it is assigned to a pod staffer, or unassigned and the
customer is a pod customer (any pod staffer could pick it up):
```sql
(assignee_id IN (SELECT id FROM staff WHERE manager_id = current_pod()))
OR
(assignee_id IS NULL AND customer_id IN (
  SELECT DISTINCT customer_id FROM orders
  WHERE staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
))
```

### 2.3 Staff Own-Finance

Staff self-service finance routes read only rows where `staff_id = current_entity_id()`. The
constraint is in every policy on `payroll_records`, `staff_penalties`, `staff_payout_methods`,
`staff_payout_requests`. Managers have zero policy on these tables.

### 2.4 Impersonation Boundary

The current impersonation feature (`admin impersonates staff / customer`) is a **frontend-only
UI concern** in Phase-0: the admin views the staff or customer portal read-only in the same
browser session. The DB is not involved.

When real auth lands, admin impersonation should work as follows:

- The admin calls a server-side **generate_impersonation_token** edge function (service-role).
- The edge function mints a short-lived token encoding the impersonated user's `role`,
  `entity_id`, and `pod_id` claims, plus a `view_only: true` flag.
- The app exchanges this token for a restricted Supabase session.
- RLS sees the impersonated user's claims and returns exactly what that user would see — no
  special impersonation bypass at the DB level.
- `view_only` is enforced at the application layer only (no INSERT/UPDATE/DELETE through the UI);
  the DB still has INSERT/UPDATE policies for the impersonated role, but they are simply never
  called by a read-only UI.

**DB rule:** the DB grants the impersonated user's effective rights. RLS is not bypassed.

### 2.5 Affiliate as a Fifth Role

`lib/rbac.ts` declares `Role = 'admin' | 'manager' | 'staff' | 'customer'` — affiliate is not
in the TypeScript union but it is in the `role_enum` in the DB. RLS policies for the affiliate
surface use `current_heva_role() = 'affiliate'` with `current_entity_id()` for self-scoping.
The frontend `can()` helper should be extended to add `affiliate` as a fifth role before Phase-7.

---

## 3. Policy Translation — Table by Table

Enable RLS on every table in the migration:

```sql
-- Enable RLS on all tables (run once per table in B2 migration)
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_folders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_packages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_addons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_brief_fields       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_addons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_bundle             ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_gig_counts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_payroll_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_penalties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payout_methods     ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payout_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_diffs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_audiences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_receipts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_audiences            ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_resources            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_attachments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_tier_configs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_sla             ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_routing         ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_scoring         ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations             ENABLE ROW LEVEL SECURITY;
```

---

### 3.1 `users` — Capability: `admin.access`, `staff.manage`, `customers.manage`

```sql
-- Admin: full access
CREATE POLICY users_admin_all ON users
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Any authenticated user: read own row (for profile / settings)
CREATE POLICY users_self_select ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());
```

---

### 3.2 `customers` — Capability: `customers.manage` (admin/manager), `portal.use` (customer self)

Admin queries the base table. Manager clients must query `orders_manager` and
`customers_manager` views (see §2.1). The base table policies below apply regardless.

```sql
-- Admin: full CRUD
CREATE POLICY customers_admin_all ON customers
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Manager: pod-scoped SELECT only (no INSERT/UPDATE — admin manages customer records)
-- NOTE: managers should query the customers_manager view, not this base table.
-- This policy is a fallback safety net; the view enforces column redaction.
CREATE POLICY customers_manager_select ON customers
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND id IN (
      SELECT DISTINCT o.customer_id FROM orders o
      WHERE o.staff_id IN (
        SELECT s.id FROM staff s WHERE s.manager_id = current_pod()
      )
    )
  );

-- Customer: own row only
CREATE POLICY customers_self_select ON customers
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND user_id = auth.uid()
  );
```

---

### 3.3 `staff` — Capability: `staff.manage` (admin/manager), `staff.self` (staff own row)

```sql
-- Admin: full CRUD
CREATE POLICY staff_admin_all ON staff
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Manager: pod-scoped SELECT
CREATE POLICY staff_manager_select ON staff
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND manager_id = current_pod()
  );

-- Staff: own row SELECT (for profile display)
CREATE POLICY staff_self_select ON staff
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND id = current_entity_id()
  );

-- Staff: own row UPDATE for availability / settings fields only
-- Enforce column restrictions via application layer; RLS enforces row scope.
CREATE POLICY staff_self_update ON staff
  FOR UPDATE TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND id = current_entity_id()
  )
  WITH CHECK (
    current_heva_role() = 'staff'
    AND id = current_entity_id()
  );
```

---

### 3.4 `managers` — Capability: `managers.manage` (admin only)

```sql
-- Admin: full CRUD
CREATE POLICY managers_admin_all ON managers
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Manager: own row SELECT (for settings / profile)
CREATE POLICY managers_self_select ON managers
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND id = current_entity_id()
  );
```

Note: `managers.manage` is admin-only in `rbac.ts`. Managers cannot list or edit other managers.

---

### 3.5 `orders` — Capability: `orders.manage` (admin/manager), `portal.use` (customer), `staff.work` (assigned staff)

```sql
-- Admin: full CRUD
CREATE POLICY orders_admin_all ON orders
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Manager: pod-scoped SELECT (assigned to pod staff, OR unassigned)
-- NOTE: managers should query orders_manager view for column redaction.
CREATE POLICY orders_manager_select ON orders
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND (
      staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
      OR staff_id IS NULL
    )
  );

-- Manager: can UPDATE orders they can see (status transitions, assignment)
CREATE POLICY orders_manager_update ON orders
  FOR UPDATE TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND (
      staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
      OR staff_id IS NULL
    )
  )
  WITH CHECK (
    current_heva_role() = 'manager'
  );

-- Customer: own orders only
CREATE POLICY orders_customer_select ON orders
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND customer_id = current_entity_id()
  );

-- Customer: INSERT (place an order)
CREATE POLICY orders_customer_insert ON orders
  FOR INSERT TO authenticated
  WITH CHECK (
    current_heva_role() = 'customer'
    AND customer_id = current_entity_id()
  );

-- Staff: own assigned orders SELECT
-- Capability: staff.work
CREATE POLICY orders_staff_select ON orders
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );
```

---

### 3.6 `order_brief_fields` — inherits from `orders`

```sql
CREATE POLICY order_brief_admin ON order_brief_fields
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY order_brief_manager ON order_brief_fields
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND order_id IN (
      SELECT id FROM orders WHERE
        staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
        OR staff_id IS NULL
    )
  );

CREATE POLICY order_brief_staff ON order_brief_fields
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND order_id IN (SELECT id FROM orders WHERE staff_id = current_entity_id())
  );

CREATE POLICY order_brief_customer ON order_brief_fields
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND order_id IN (SELECT id FROM orders WHERE customer_id = current_entity_id())
  );
```

---

### 3.7 `deliverables` — Capability: `review.manage` (admin/manager), `staff.work` (staff own), `portal.use` (customer own order)

```sql
-- Admin: full CRUD
CREATE POLICY deliverables_admin_all ON deliverables
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Manager: pod-scoped SELECT + UPDATE (review / approve)
CREATE POLICY deliverables_manager_select ON deliverables
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
  );

CREATE POLICY deliverables_manager_update ON deliverables
  FOR UPDATE TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
  )
  WITH CHECK (current_heva_role() = 'manager');

-- Staff: own deliverables only; can INSERT new ones
CREATE POLICY deliverables_staff_select ON deliverables
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );

CREATE POLICY deliverables_staff_insert ON deliverables
  FOR INSERT TO authenticated
  WITH CHECK (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );

-- Customer: deliverables on own orders
CREATE POLICY deliverables_customer_select ON deliverables
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND order_id IN (SELECT id FROM orders WHERE customer_id = current_entity_id())
  );
```

---

### 3.8 `tickets` & `ticket_messages` — Capability: `tickets.manage` (admin/manager), `portal.use` (customer), `staff.work` (assigned staff)

```sql
-- Admin: full CRUD
CREATE POLICY tickets_admin_all ON tickets
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Manager: pod-scoped (assigned to pod staffer, or unassigned on pod customer)
CREATE POLICY tickets_manager_select ON tickets
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND (
      assignee_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
      OR (
        assignee_id IS NULL
        AND customer_id IN (
          SELECT DISTINCT o.customer_id FROM orders o
          WHERE o.staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
        )
      )
    )
  );

CREATE POLICY tickets_manager_update ON tickets
  FOR UPDATE TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND (
      assignee_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
      OR assignee_id IS NULL
    )
  )
  WITH CHECK (current_heva_role() = 'manager');

-- Staff: assigned tickets only
CREATE POLICY tickets_staff_select ON tickets
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND assignee_id = current_entity_id()
  );

CREATE POLICY tickets_staff_insert ON tickets
  FOR INSERT TO authenticated
  WITH CHECK (current_heva_role() = 'staff');

CREATE POLICY tickets_staff_update ON tickets
  FOR UPDATE TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND assignee_id = current_entity_id()
  )
  WITH CHECK (current_heva_role() = 'staff');

-- Customer: own tickets
CREATE POLICY tickets_customer_select ON tickets
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND customer_id = current_entity_id()
  );

CREATE POLICY tickets_customer_insert ON tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    current_heva_role() = 'customer'
    AND customer_id = current_entity_id()
  );

-- ticket_messages — mirror ticket access
CREATE POLICY ticket_msg_admin ON ticket_messages
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY ticket_msg_manager ON ticket_messages
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND ticket_id IN (
      SELECT id FROM tickets WHERE
        assignee_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
        OR (assignee_id IS NULL AND customer_id IN (
          SELECT DISTINCT o.customer_id FROM orders o
          WHERE o.staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
        ))
    )
  );

CREATE POLICY ticket_msg_staff ON ticket_messages
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND ticket_id IN (SELECT id FROM tickets WHERE assignee_id = current_entity_id())
  )
  WITH CHECK (current_heva_role() = 'staff');

CREATE POLICY ticket_msg_customer ON ticket_messages
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND ticket_id IN (SELECT id FROM tickets WHERE customer_id = current_entity_id())
  )
  WITH CHECK (current_heva_role() = 'customer');
```

---

### 3.9 Finance Tables — Capability: `finance.view` (admin only)

`payroll_records`, `payroll_gig_counts`, `manager_payroll_records`, `transactions`, `invoices`,
`invoice_orders` are **admin-only**. No policy for manager, staff, or customer on these base tables.

```sql
-- payroll_records
CREATE POLICY payroll_admin_all ON payroll_records
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY payroll_gig_admin_all ON payroll_gig_counts
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- manager_payroll_records
CREATE POLICY mgr_payroll_admin_all ON manager_payroll_records
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- transactions
CREATE POLICY transactions_admin_all ON transactions
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- invoices
CREATE POLICY invoices_admin_all ON invoices
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Customer: own invoices (for portal billing view)
CREATE POLICY invoices_customer_select ON invoices
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND customer_id = current_entity_id()
  );

CREATE POLICY invoice_orders_admin_all ON invoice_orders
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY invoice_orders_customer_select ON invoice_orders
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND invoice_id IN (
      SELECT id FROM invoices WHERE customer_id = current_entity_id()
    )
  );
```

---

### 3.10 Staff Finance (Self-Service) — Capability: `staff.self`

`staff_penalties`, `staff_payout_methods`, `staff_payout_requests` are staff-self only.
Managers have zero policy here (money-blind enforcement at the table level, not just the view).

```sql
-- staff_penalties
CREATE POLICY penalties_admin_all ON staff_penalties
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY penalties_staff_self ON staff_penalties
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );

-- Staff can dispute own penalty (UPDATE with check on dispute_note only)
CREATE POLICY penalties_staff_dispute ON staff_penalties
  FOR UPDATE TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
    AND status = 'pending'
  )
  WITH CHECK (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );

-- staff_payout_methods
CREATE POLICY payout_methods_admin_all ON staff_payout_methods
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY payout_methods_staff_self ON staff_payout_methods
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  )
  WITH CHECK (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );

-- staff_payout_requests
CREATE POLICY payout_requests_admin_all ON staff_payout_requests
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY payout_requests_staff_self ON staff_payout_requests
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  )
  WITH CHECK (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );
```

---

### 3.11 `leave_requests` — Capability: `staff.self` (own), `assignment.manage` (admin/manager)

```sql
CREATE POLICY leave_admin_all ON leave_requests
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Manager: pod-scoped approve/decline
CREATE POLICY leave_manager_select ON leave_requests
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
  );

CREATE POLICY leave_manager_update ON leave_requests
  FOR UPDATE TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
  )
  WITH CHECK (current_heva_role() = 'manager');

-- Staff: own requests
CREATE POLICY leave_staff_self ON leave_requests
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  )
  WITH CHECK (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );
```

---

### 3.12 Catalog — Capability: `catalog.manage` (admin), `catalog.view` (manager), public read for service listing

```sql
-- catalog_services: public read, admin write
CREATE POLICY catalog_svc_public_select ON catalog_services
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY catalog_svc_admin_write ON catalog_services
  FOR INSERT TO authenticated
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY catalog_svc_admin_update ON catalog_services
  FOR UPDATE TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY catalog_svc_admin_delete ON catalog_services
  FOR DELETE TO authenticated
  USING (current_heva_role() = 'admin');

-- catalog_packages: public read (pricing shown to customers via portal), admin write
-- NOTE: gig_rate column is staff pay — must not be exposed to customers or managers.
-- Serve catalog_packages through a server route that strips gig_rate for non-admin callers.
CREATE POLICY catalog_pkg_public_select ON catalog_packages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY catalog_pkg_admin_write ON catalog_packages
  FOR INSERT TO authenticated
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY catalog_pkg_admin_update ON catalog_packages
  FOR UPDATE TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY catalog_pkg_admin_delete ON catalog_packages
  FOR DELETE TO authenticated
  USING (current_heva_role() = 'admin');

-- catalog_addons: same as packages
CREATE POLICY catalog_addon_public_select ON catalog_addons
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY catalog_addon_admin_write ON catalog_addons
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');
```

> `gig_rate` in `catalog_packages` is a pay rate column (staff piece-rate). Strip it in server
> routes before sending to non-admin callers. A `catalog_packages_public` view without `gig_rate`
> is the clean solution (same pattern as `orders_manager`).

---

### 3.13 `assignment_rules` — Capability: `assignment.manage` (admin/manager)

```sql
CREATE POLICY rules_admin_all ON assignment_rules
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Manager: read rules to understand routing logic; cannot create/modify
CREATE POLICY rules_manager_select ON assignment_rules
  FOR SELECT TO authenticated
  USING (current_heva_role() = 'manager');
```

---

### 3.14 `audit_events` & `audit_diffs` — Capability: `audit.view` (admin/manager)

```sql
CREATE POLICY audit_admin_all ON audit_events
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Manager: pod-scoped audit events (actor in pod, or entity is pod staff/order/customer)
-- The pod-scope logic mirrors managerScope.ts::auditInPod()
CREATE POLICY audit_manager_select ON audit_events
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND (
      -- actor is pod staff
      actor_id IN (
        SELECT user_id FROM staff WHERE manager_id = current_pod()
      )
      -- OR entity is a pod staff member
      OR (entity = 'staff' AND entity_id IN (
        SELECT id FROM staff WHERE manager_id = current_pod()
      ))
      -- OR entity is a pod order
      OR (entity = 'order' AND entity_id IN (
        SELECT id FROM orders WHERE staff_id IN (
          SELECT id FROM staff WHERE manager_id = current_pod()
        )
      ))
      -- OR entity is a pod customer
      OR (entity = 'customer' AND entity_id IN (
        SELECT DISTINCT o.customer_id::text FROM orders o
        WHERE o.staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
      ))
    )
  );

-- audit_diffs follow audit_events access
CREATE POLICY audit_diffs_admin_all ON audit_diffs
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY audit_diffs_manager_select ON audit_diffs
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND audit_id IN (
      SELECT id FROM audit_events WHERE
        actor_id IN (SELECT user_id FROM staff WHERE manager_id = current_pod())
        OR (entity = 'staff' AND entity_id IN (SELECT id FROM staff WHERE manager_id = current_pod()))
    )
  );
```

> **Money event filtering** (`isMoneyEvent()` in `managerPulse.ts`) is an app-layer concern for
> the activity feed. RLS allows managers to read the audit row; the app-layer strips money events
> from the ops feed. Phase-3 improvement: add a `is_financial boolean` column to `audit_events`
> (set by a trigger) and add `AND NOT is_financial` to the manager SELECT policy.

---

### 3.15 `broadcasts`, `broadcast_audiences`, `broadcast_receipts` — Capability: `broadcasts.manage` (admin), inbox (all roles)

```sql
-- broadcasts: admin full CRUD
CREATE POLICY broadcasts_admin_all ON broadcasts
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- All roles: read active, non-expired broadcasts that target their audience
CREATE POLICY broadcasts_recipient_select ON broadcasts
  FOR SELECT TO authenticated
  USING (
    active = true
    AND (publish_at IS NULL OR publish_at <= now())
    AND (expires_at IS NULL OR expires_at >= current_date)
    AND id IN (
      SELECT broadcast_id FROM broadcast_audiences
      WHERE audience = current_heva_role()::broadcast_audience
    )
  );

-- broadcast_audiences: admin manages; recipients read own audience rows
CREATE POLICY broadcast_aud_admin_all ON broadcast_audiences
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY broadcast_aud_recipient_select ON broadcast_audiences
  FOR SELECT TO authenticated
  USING (audience = current_heva_role()::broadcast_audience);

-- broadcast_receipts: admin reads all (for stats); users manage own receipts
CREATE POLICY receipts_admin_all ON broadcast_receipts
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY receipts_self_all ON broadcast_receipts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

### 3.16 `docs`, `doc_audiences`, `doc_resources` — Capability: `docs.manage` (admin), `staff.knowledge` / `manager.access` / `portal.use` (read)

```sql
-- Admin: full CRUD
CREATE POLICY docs_admin_all ON docs
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

-- Staff: docs distributed to their skill audience (keyword/backlink/content/optimize/general)
CREATE POLICY docs_staff_select ON docs
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND id IN (
      SELECT doc_id FROM doc_audiences
      WHERE audience IN (
        -- staff's skills map to doc audiences
        SELECT UNNEST(skills)::doc_audience FROM staff WHERE id = current_entity_id()
        UNION ALL SELECT 'general'::doc_audience
      )
    )
  );

-- Manager: docs with audience='manager' or 'general'
CREATE POLICY docs_manager_select ON docs
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND id IN (
      SELECT doc_id FROM doc_audiences
      WHERE audience IN ('manager', 'general')
    )
  );

-- Customer: docs with audience='customer'
CREATE POLICY docs_customer_select ON docs
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND id IN (
      SELECT doc_id FROM doc_audiences WHERE audience = 'customer'
    )
  );

-- doc_audiences and doc_resources follow docs access
CREATE POLICY doc_aud_admin_all ON doc_audiences
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY doc_aud_recipient_select ON doc_audiences
  FOR SELECT TO authenticated
  USING (
    doc_id IN (SELECT id FROM docs)  -- filtered by docs policies above
  );

CREATE POLICY doc_res_admin_all ON doc_resources
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY doc_res_recipient_select ON doc_resources
  FOR SELECT TO authenticated
  USING (
    doc_id IN (SELECT id FROM docs)  -- filtered by docs policies above
  );
```

---

### 3.17 `notes`, `note_attachments` — Capability: all roles; own notes only (`notes.internal.view` for internal content)

Notes are private per owner. There is no cross-user note sharing. `owner_role` + `owner_id` enforce
four separate namespace buckets (admin, manager, staff, customer).

```sql
-- notes: each user reads and manages only their own notes
CREATE POLICY notes_owner_all ON notes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- note_attachments follow note ownership
CREATE POLICY note_attachments_owner_all ON note_attachments
  FOR ALL TO authenticated
  USING (
    note_id IN (SELECT id FROM notes WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    note_id IN (SELECT id FROM notes WHERE owner_id = auth.uid())
  );
```

> The `owner_role` column exists to ensure an admin and a manager who share the same `auth.uid()`
> (impossible under the current model where each user has one role, but a safeguard) cannot see
> each other's notes. It also namespaces the UI queries: `/staff/notes` queries with
> `owner_role = 'staff'`, `/manager/notes` queries with `owner_role = 'manager'`, etc.

---

### 3.18 Affiliate Tables — Capability: `affiliate.manage` (admin), self-service (affiliate)

```sql
-- affiliates
CREATE POLICY affiliates_admin_all ON affiliates
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY affiliates_self_select ON affiliates
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'affiliate'
    AND id = current_entity_id()
  );

-- Public INSERT for the join/apply form (unauthenticated affiliates applying)
-- Use anon key + SECURITY DEFINER server action to handle application submission.
-- Do NOT expose an anon INSERT policy on affiliates directly.

-- affiliate_referrals
CREATE POLICY referrals_admin_all ON affiliate_referrals
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY referrals_self_select ON affiliate_referrals
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'affiliate'
    AND affiliate_id = current_entity_id()
  );

-- commission_events
CREATE POLICY commission_admin_all ON commission_events
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY commission_self_select ON commission_events
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'affiliate'
    AND affiliate_id = current_entity_id()
  );

-- affiliate_payout_requests
CREATE POLICY aff_payouts_admin_all ON affiliate_payout_requests
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY aff_payouts_self_all ON affiliate_payout_requests
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'affiliate'
    AND affiliate_id = current_entity_id()
  )
  WITH CHECK (
    current_heva_role() = 'affiliate'
    AND affiliate_id = current_entity_id()
  );

-- program_rules & affiliate_tier_configs: admin write, affiliate read
CREATE POLICY program_rules_admin_all ON program_rules
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY program_rules_affiliate_select ON program_rules
  FOR SELECT TO authenticated
  USING (current_heva_role() = 'affiliate');

CREATE POLICY tier_config_admin_all ON affiliate_tier_configs
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY tier_config_affiliate_select ON affiliate_tier_configs
  FOR SELECT TO authenticated
  USING (current_heva_role() = 'affiliate');

-- marketing_assets: affiliate read-only
CREATE POLICY marketing_assets_admin ON marketing_assets
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY marketing_assets_affiliate_select ON marketing_assets
  FOR SELECT TO authenticated
  USING (current_heva_role() = 'affiliate');
```

---

### 3.19 `notifications` — Capability: `staff.self`, `portal.use`, `manager.access`

```sql
-- Each user reads and marks their own notifications
CREATE POLICY notifications_owner_all ON notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin: can read all (for support / debug)
CREATE POLICY notifications_admin_select ON notifications
  FOR SELECT TO authenticated
  USING (current_heva_role() = 'admin');
```

---

### 3.20 `projects` & `project_folders` — Capability: `customers.manage`, `portal.use`

```sql
CREATE POLICY projects_admin_all ON projects
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY projects_manager_select ON projects
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND customer_id IN (
      SELECT DISTINCT o.customer_id FROM orders o
      WHERE o.staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
    )
  );

CREATE POLICY projects_customer_own ON projects
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND customer_id = current_entity_id()
  )
  WITH CHECK (
    current_heva_role() = 'customer'
    AND customer_id = current_entity_id()
  );

-- project_folders mirror projects
CREATE POLICY folders_admin_all ON project_folders
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY folders_manager_select ON project_folders
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND project_id IN (
      SELECT id FROM projects WHERE customer_id IN (
        SELECT DISTINCT o.customer_id FROM orders o
        WHERE o.staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
      )
    )
  );

CREATE POLICY folders_customer_own ON project_folders
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'customer'
    AND project_id IN (SELECT id FROM projects WHERE customer_id = current_entity_id())
  )
  WITH CHECK (
    current_heva_role() = 'customer'
    AND project_id IN (SELECT id FROM projects WHERE customer_id = current_entity_id())
  );
```

---

### 3.21 Settings — Capability: `org.settings` (admin only)

```sql
CREATE POLICY settings_admin_all ON settings_sla
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY settings_routing_admin ON settings_routing
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY settings_scoring_admin ON settings_scoring
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY email_templates_admin ON email_templates
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY integrations_admin ON integrations
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');
```

---

### 3.22 `staff_availability` & `staff_work_hours` — Capability: `staff.self` (own), `staff.manage` (admin/manager read)

```sql
CREATE POLICY avail_admin_all ON staff_availability
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY avail_manager_select ON staff_availability
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
  );

CREATE POLICY avail_staff_self ON staff_availability
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  )
  WITH CHECK (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );

CREATE POLICY workhours_admin_all ON staff_work_hours
  FOR ALL TO authenticated
  USING (current_heva_role() = 'admin')
  WITH CHECK (current_heva_role() = 'admin');

CREATE POLICY workhours_manager_select ON staff_work_hours
  FOR SELECT TO authenticated
  USING (
    current_heva_role() = 'manager'
    AND staff_id IN (SELECT id FROM staff WHERE manager_id = current_pod())
  );

CREATE POLICY workhours_staff_self ON staff_work_hours
  FOR ALL TO authenticated
  USING (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  )
  WITH CHECK (
    current_heva_role() = 'staff'
    AND staff_id = current_entity_id()
  );
```

---

## 4. Per-Role Test Matrix

This table is the assertion surface for Phase B2 RLS tests (`TESTING.md`). Each cell is the
expected Postgres result when that role's client performs the operation. "deny" means 0 rows
returned (RLS silently filters, not an error). "error" means no policy exists and RLS raises a
permission error (only for INSERT/UPDATE/DELETE with no matching `WITH CHECK` policy).

| Table | Operation | admin | manager | staff (own) | staff (other) | customer (own) | customer (other) | affiliate |
|---|---|---|---|---|---|---|---|---|
| `orders` | SELECT | allow (all) | allow (pod) | allow | deny | allow | deny | deny |
| `orders` | INSERT | allow | deny | deny | deny | allow | deny | deny |
| `orders` | UPDATE | allow | allow (pod) | deny | deny | deny | deny | deny |
| `orders` | DELETE | allow | deny | deny | deny | deny | deny | deny |
| `orders.value` col | SELECT | visible | redacted (view) | visible (own) | — | visible | — | — |
| `customers` | SELECT | allow (all) | allow (pod, spend/balance redacted) | deny | deny | allow (self) | deny | deny |
| `customers.balance` col | SELECT | visible | redacted (view) | — | — | visible | — | — |
| `staff` | SELECT | allow (all) | allow (pod) | allow (self) | deny | deny | deny | deny |
| `managers` | SELECT | allow (all) | allow (self) | deny | deny | deny | deny | deny |
| `deliverables` | SELECT | allow (all) | allow (pod) | allow (own) | deny | allow (own order) | deny | deny |
| `deliverables` | INSERT | allow | deny | allow | deny | deny | deny | deny |
| `deliverables` | UPDATE | allow | allow (pod) | deny | deny | deny | deny | deny |
| `tickets` | SELECT | allow (all) | allow (pod) | allow (assigned) | deny | allow (own) | deny | deny |
| `ticket_messages` | SELECT | allow (all) | allow (pod tickets) | allow (assigned) | deny | allow (own) | deny | deny |
| `payroll_records` | SELECT | allow (all) | deny | deny | deny | deny | deny | deny |
| `transactions` | SELECT | allow (all) | deny | deny | deny | deny | deny | deny |
| `invoices` | SELECT | allow (all) | deny | deny | deny | allow (own) | deny | deny |
| `staff_penalties` | SELECT | allow (all) | deny | allow (self) | deny | deny | deny | deny |
| `staff_payout_requests` | SELECT | allow (all) | deny | allow (self) | deny | deny | deny | deny |
| `leave_requests` | SELECT | allow (all) | allow (pod) | allow (self) | deny | deny | deny | deny |
| `audit_events` | SELECT | allow (all) | allow (pod events, incl. money events\*) | deny | deny | deny | deny | deny |
| `broadcasts` | SELECT | allow (all) | allow (active, manager audience) | allow (active, staff audience) | — | allow (active, customer audience) | — | allow (affiliate audience) |
| `broadcast_receipts` | ALL | allow (all) | allow (self) | allow (self) | — | allow (self) | — | allow (self) |
| `docs` | SELECT | allow (all) | allow (manager/general audience) | allow (skill audience) | — | allow (customer audience) | — | deny |
| `notes` | ALL | allow (self only) | allow (self only) | allow (self only) | deny | allow (self only) | deny | deny |
| `affiliates` | SELECT | allow (all) | deny | deny | deny | deny | deny | allow (self) |
| `commission_events` | SELECT | allow (all) | deny | deny | deny | deny | deny | allow (self) |
| `catalog_services` | SELECT | allow | allow | allow | — | allow | — | allow |
| `catalog_packages` | SELECT | allow (incl. gig_rate) | allow (gig_rate stripped server-side) | allow (gig_rate stripped) | — | allow (gig_rate stripped) | — | deny |
| `assignment_rules` | SELECT | allow | allow | deny | deny | deny | deny | deny |
| `assignment_rules` | INSERT/UPDATE/DELETE | allow | deny | deny | deny | deny | deny | deny |
| `settings_sla` | ALL | allow | deny | deny | deny | deny | deny | deny |
| `notifications` | ALL | allow (all) | allow (self) | allow (self) | deny | allow (self) | deny | deny |

\* Money events in audit are readable by the manager policy (row level). Stripping them from the
ops activity feed is an application-layer concern (`isMoneyEvent()` in `managerPulse.ts`).
Phase-3 improvement: add `is_financial` boolean column and include it in the manager SELECT policy.

---

## 5. Service-Role Escape Hatch

### When to Use

The `service_role` key bypasses RLS entirely. Use it only for:

| Use case | Where | Example |
|---|---|---|
| **Seeding / migrations** | `supabase/seed.sql` or migration files | Insert mock data for Phase B3 |
| **Background jobs** | Edge Functions with `SUPABASE_SERVICE_ROLE_KEY` | Nightly payroll compute, commission clearing cron |
| **Admin server actions** that must write across-user rows | Server Action, `createClient('service')` | Admin triggers staff payout across multiple rows |
| **Impersonation token minting** | Edge Function | Generate short-lived impersonation JWT |
| **Affiliate join** | Edge Function | Insert a new affiliate row on public apply form |

### The Invariant

**The service-role client must never execute queries built from client-supplied input without prior
Zod validation.** The service-role bypasses RLS; an injection in a service-role query has
unrestricted write access to every table.

Pattern:
```typescript
// Server Action — safe pattern
'use server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const Input = z.object({ staffId: z.string().min(1), amount: z.number().positive() });

export async function triggerPayout(raw: unknown) {
  const { staffId, amount } = Input.parse(raw);   // validate before service-role
  const supabase = createServiceClient();           // bypasses RLS
  await supabase.from('staff_payout_requests').insert({ staff_id: staffId, amount, ... });
}
```

### Two Supabase Clients

```typescript
// lib/supabase/client.ts — authenticated client (RLS active)
import { createServerClient } from '@supabase/ssr';
export function createAuthClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { ... } }
  );
}

// lib/supabase/service.ts — service-role client (RLS bypassed)
import { createClient } from '@supabase/supabase-js';
export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // never expose to client bundle
  );
}
```

`SUPABASE_SERVICE_ROLE_KEY` must never be in a `NEXT_PUBLIC_*` env var. It lives in server-only
env (`.env.local`, Vercel environment with "server" scope). The client bundle must never import
`lib/supabase/service.ts`.

---

## 6. rbac.ts Rules That Did Not Map Cleanly to RLS

### 6.1 `pricing.view` — column-level, not row-level

`pricing.view` is about hiding columns (`value`, `spend`, `balance`, `gig_rate`), not rows. RLS
has no native column policy. Solved via redacting views (`orders_manager`,
`customers_manager`, `catalog_packages_public`) — see §2.1.

### 6.2 `notes.internal.view` — content-flag filtering, not row filtering

`notes.internal.view` gates internal thread messages from customers. This is not a separate table;
it is a `visibility` flag on individual messages inside a shared thread. RLS cannot filter on a
flag inside a `jsonb` array column. The enforcement must stay at the application layer: the
server route that builds `TicketMessageThread` for a customer caller strips messages where
`visibility = 'internal'`. Phase-3 fix: normalize `ticket_messages` with a `visibility` column
and add a customer SELECT policy `WHERE visibility = 'public'`.

### 6.3 `catalog.view` vs `catalog.manage` — same table, different write rights

`catalog.view` (manager) and `catalog.manage` (admin) point at the same `catalog_services` and
`catalog_packages` tables. RLS handles this cleanly: the manager gets a SELECT policy, the admin
gets all-operation policies. No gap here — included because the dual capability could confuse.

### 6.4 `admin.access` umbrella — no direct RLS analog

`admin.access` is a route-access gate in `rbac.ts`, not a data-access gate. It has no table
behind it. Managers also hold `admin.access` (they can see the admin shell) but are excluded
from finance/analytics/org-settings tables by having no policy on those tables. The route guard
remains in Next.js middleware (`canAccessPath`); RLS enforces the data gate.

### 6.5 `staff.knowledge` / `docs.manage` — audience-based doc distribution

The `doc_audiences` M:M table maps docs to audience segments. A staff member's readable docs
depend on their `skills` array, which varies per staffer. This is handled at RLS but requires a
subquery against the staffer's own `staff.skills` row. If `staff.skills` is wide, this subquery
runs on every doc SELECT. Index: `CREATE INDEX ON staff(id) INCLUDE (skills)` and
`CREATE INDEX ON doc_audiences(audience)`.

### 6.6 `affiliate.manage` / affiliate portal — fifth role not in rbac.ts

As noted in §2.5, affiliate RLS policies use `current_heva_role() = 'affiliate'` which works
at the DB level. The TypeScript `rbac.ts` `Role` type must be extended with `'affiliate'` before
Phase-7, or the affiliate portal must live entirely behind a service-role server route with its
own session validation — either approach is valid.

---

## 7. Summary

- **Tables with RLS policies:** 46 tables (all tables listed in §1 `ALTER TABLE … ENABLE ROW LEVEL SECURITY`).
- **Money-blind approach:** Finance tables (`payroll_records`, `manager_payroll_records`, `transactions`, `invoices`, `staff_payout_*`, `staff_penalties`) have zero manager SELECT policy. Money columns in ops tables (`orders.value`, `customers.spend/balance`, `catalog_packages.gig_rate`) are redacted via SECURITY DEFINER views (`orders_manager`, `customers_manager`, `catalog_packages_public`) that the manager's Supabase client queries instead of the base tables.
- **Pod-scope:** enforced via `current_pod()` helper in manager SELECT/UPDATE policies on `orders`, `customers`, `staff`, `tickets`, `deliverables`, `leave_requests`, `audit_events`, `staff_availability`, `staff_work_hours`.
- **Staff own-finance:** `staff_penalties`, `staff_payout_methods`, `staff_payout_requests`, `payroll_records` gate staff to `staff_id = current_entity_id()` only; managers have no policy on any of these tables.
- **rbac.ts rules that did not map cleanly to RLS:** `pricing.view` (column-level, solved via views), `notes.internal.view` (content-flag inside a shared thread, enforced at app layer until `ticket_messages.visibility` column is normalized), and `admin.access` (route gate only, no data table).
- **Service-role rule:** bypass is legitimate for seeding, background jobs, and impersonation token minting only; all service-role queries require Zod validation of any client-supplied input before execution.
