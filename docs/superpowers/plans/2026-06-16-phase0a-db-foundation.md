# Phase 0a — Database Foundation & Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a reproducible local Supabase stack with a migration pipeline and a green pgTAP test loop, so every later schema/RLS/function task in Phase 0 can be written test-first.

**Architecture:** Use the Supabase CLI (added as a root dev dependency) to run the full self-host stack locally in Docker. Database changes live as timestamped SQL migrations under `supabase/migrations/`. Tests are pgTAP assertions under `supabase/tests/`, run by `supabase test db`. A single `pnpm verify:db` entrypoint rebuilds the DB from migrations and runs the test suite — this is the loop all subsequent plans (0b–0e) reuse.

**Tech Stack:** Supabase CLI (local Docker stack: Postgres 15 + Auth + Storage + Realtime), pgTAP, pnpm 10 workspaces, Node 20.

**Why this plan exists / scope:** This is sub-plan **0a** of Phase 0 from `docs/superpowers/specs/2026-06-14-hevaseo-architecture-plan.md`. It builds **only** the dev/test foundation — no business tables, no RLS, no functions yet. Those land in 0b/0c. Deliverable: a developer can clone, run `pnpm db:start && pnpm verify:db`, and see a passing pgTAP suite against a freshly-migrated database.

**Preconditions (verified 2026-06-16):** Node v20.20.0, pnpm 10.31.0, Docker 29.2.1 present. Supabase CLI NOT installed (this plan installs it as a dev dependency). `supabase/` does not exist yet.

---

### Task 1: Add the Supabase CLI and pnpm database scripts

**Files:**
- Modify: `package.json` (root) — add dev dependency + scripts
- Modify: `.gitignore` — ignore Supabase local temp dirs

- [ ] **Step 1: Add the dev dependency and scripts to root `package.json`**

Replace the contents of `package.json` (root) with:

```json
{
  "name": "hevaseo-platform",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "pnpm --filter @heva/web dev",
    "build": "pnpm --filter @heva/web build",
    "preview": "pnpm --filter @heva/web preview",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:new": "supabase migration new",
    "db:test": "supabase test db",
    "verify:db": "supabase db reset && supabase test db"
  },
  "devDependencies": {
    "supabase": "^2.0.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: pnpm resolves and installs the `supabase` package; `node_modules/.bin/supabase` now exists.

- [ ] **Step 3: Verify the CLI is callable**

Run: `pnpm supabase --version`
Expected: prints a version like `2.x.x` (no "command not found").

- [ ] **Step 4: Ignore Supabase local temp dirs**

Append these lines to `.gitignore`:

```gitignore

# Supabase local stack
supabase/.branches/
supabase/.temp/
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore
git commit -m "chore: add Supabase CLI and db scripts to workspace"
```

---

### Task 2: Initialize the Supabase project scaffolding

**Files:**
- Create: `supabase/config.toml` (generated, then edited)
- Create: `supabase/seed.sql` (generated, left as an empty placeholder for now)

- [ ] **Step 1: Run init**

Run: `pnpm supabase init`
Expected: creates `supabase/config.toml` and `supabase/seed.sql`. If prompted about generating VS Code settings or Deno, answer no.

- [ ] **Step 2: Pin the Postgres major version**

Open `supabase/config.toml`, find the `[db]` section, and set the major version to 15:

```toml
[db]
port = 54322
major_version = 15
```

(Leave the other generated sections — `[api]`, `[studio]`, `[auth]`, `[realtime]`, `[storage]` — at their defaults. These mirror the self-host stack from the spec §3.1.)

- [ ] **Step 3: Replace the generated seed file with a documented placeholder**

Overwrite `supabase/seed.sql` with:

```sql
-- supabase/seed.sql
-- Seed data applied after migrations on `supabase db reset`.
-- HevaSEO product config (workflow_states, allowed_transitions, role labels,
-- the default tenant) lands here in sub-plan 0b. Intentionally empty for 0a.
```

- [ ] **Step 4: Start the local stack to confirm it boots**

Run: `pnpm db:start`
Expected: Docker pulls images on first run, then prints local URLs (`API URL`, `DB URL`, `Studio URL`) and an `anon key` / `service_role key`. This confirms Postgres + Auth + Storage + Realtime are up.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml supabase/seed.sql
git commit -m "chore: init Supabase project scaffolding (pg15 local stack)"
```

---

### Task 3: Enable required Postgres extensions (test-first with pgTAP)

This task establishes the **TDD loop** for all SQL work: write a pgTAP test, watch it fail, write the migration, watch it pass.

**Files:**
- Create: `supabase/tests/0000_extensions_test.sql`
- Create: `supabase/migrations/<timestamp>_extensions.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0000_extensions_test.sql`:

```sql
-- supabase/tests/0000_extensions_test.sql
-- Asserts the extensions every later migration depends on are installed.
begin;
select plan(3);

select has_extension('pgcrypto', 'pgcrypto is installed (gen_random_uuid)');
select has_extension('citext',   'citext is installed (case-insensitive email)');
select has_extension('pgtap',    'pgtap is installed (so these tests can run)');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test and verify it FAILS**

Run: `pnpm verify:db`
Expected: `supabase db reset` succeeds (no migrations yet), then `supabase test db` FAILS — the `has_extension` assertions report the extensions are not installed (and/or pgtap is unavailable to run the file).

- [ ] **Step 3: Create the migration file**

Run: `pnpm db:new extensions`
Expected: creates `supabase/migrations/<timestamp>_extensions.sql` (the timestamp prefix is generated by the CLI — do not rename it).

Put this exact content into that new file:

```sql
-- Enable foundational extensions used across the schema.
create extension if not exists pgcrypto;   -- gen_random_uuid() for primary keys
create extension if not exists citext;      -- case-insensitive text (emails)
create extension if not exists pgtap;       -- in-database test framework
```

- [ ] **Step 4: Run the test and verify it PASSES**

Run: `pnpm verify:db`
Expected: `supabase db reset` applies the new migration, then `supabase test db` prints `ok` for all 3 assertions and finishes with `Result: PASS` (or pg_prove `Result: PASS`, all tests successful).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ supabase/tests/0000_extensions_test.sql
git commit -m "feat(db): enable pgcrypto, citext, pgtap with passing smoke test"
```

---

### Task 4: Document the development loop

So the next engineer (and sub-plans 0b–0e) can start without rediscovering the commands.

**Files:**
- Create: `supabase/README.md`

- [ ] **Step 1: Write the README**

Create `supabase/README.md`:

```markdown
# HevaSEO — Database (Supabase, self-hosted)

Local mirror of the production self-host stack (Postgres 15 + Auth + Storage + Realtime).

## Daily loop

```bash
pnpm db:start        # boot the local stack (Docker) — once per session
pnpm db:new <name>   # scaffold a new timestamped migration in migrations/
pnpm verify:db       # rebuild DB from migrations + seed, then run pgTAP tests
pnpm db:stop         # shut the stack down
```

`pnpm verify:db` (= `db reset` + `test db`) is the gate: every schema/RLS/function
change must keep it green. Write the pgTAP test in `tests/` first, watch it fail,
then add the migration in `migrations/`.

## Layout

| Path | Purpose |
|---|---|
| `config.toml` | Supabase CLI config (ports, pg version, stack toggles) |
| `migrations/`  | Timestamped SQL, applied in order. Never edit a committed migration — add a new one. |
| `tests/`       | pgTAP test files (`*_test.sql`), run by `supabase test db`. |
| `seed.sql`     | Product config + default tenant, applied after migrations on reset. |

## Conventions

- Primary keys: `uuid default gen_random_uuid()`.
- Every business table carries `tenant_id` (see spec D11) and indexes RLS-predicate columns.
- Sensitive writes go through `SECURITY DEFINER` functions, not direct UPDATEs (see spec §4).
- RLS is the source of truth; the app connects with the user's JWT, never `service_role`
  except in the webhook handler, the BullMQ worker, and migration/seed scripts.

See `docs/superpowers/specs/2026-06-14-hevaseo-architecture-plan.md` for the full architecture.
```

- [ ] **Step 2: Verify the documented loop actually works end-to-end**

Run: `pnpm db:stop && pnpm db:start && pnpm verify:db`
Expected: stack stops, restarts, and the pgTAP suite passes — confirming the README's loop is accurate from a cold start.

- [ ] **Step 3: Commit**

```bash
git add supabase/README.md
git commit -m "docs(db): document the local migration + pgTAP test loop"
```

---

## Self-Review

**1. Spec coverage (this sub-plan's slice of Phase 0):**
- §10 "(d) test RLS ... bộ test" → harness established (pgTAP via `supabase test db`, `verify:db` gate). ✅ (actual RLS tests land in 0b, which depends on this.)
- §3.1 self-host stack (Postgres + Auth + Storage + Realtime) → `supabase start` runs all locally. ✅
- §6 `pgcrypto`/`citext` needs (uuid PKs, case-insensitive email for anti-collision §7 chốt 5) → extensions migration. ✅
- Deferred by design to later sub-plans: tenant_id schema (0b), RLS policies (0b), DB functions (0c), core boundary lint (0d), pooler/replica/partition-maintenance (0e). Listed explicitly at the top so nothing is silently dropped.

**2. Placeholder scan:** No "TBD"/"handle appropriately"/"write tests for the above". `seed.sql` is intentionally empty *with a comment saying why and where it gets filled* — that is documentation, not a placeholder gap. ✅

**3. Type/name consistency:** Script names (`db:start`, `db:reset`, `db:new`, `db:test`, `verify:db`) are defined once in Task 1 and referenced identically in Tasks 3–4 and the README. Test file `0000_extensions_test.sql` and the extensions it asserts (`pgcrypto`, `citext`, `pgtap`) match the migration content in Task 3 exactly. ✅

---

## Next sub-plans (Phase 0 roadmap)

Each builds on `pnpm verify:db` from this plan and is written when 0a is green:

- **0b — Core schema + RLS:** `tenants`, `profiles` (capability enum), `customers`, catalog, `orders` (FK `workflow_states`), `tasks`, `deliverables`, `messages`, `notifications`, `credit_ledger`, `customer_balances`, `audit_log` — all with `tenant_id`; RLS policies by capability + tenant; pgTAP RLS tests ("role X / tenant A cannot see role Y / tenant B"); HevaSEO seed (default tenant, workflow states, transitions).
- **0c — DB functions:** `create_order` (O(1) balance guard), `advance_order` (transition validation), `cancel_order` (refund), `topup`, `write_audit`; pgTAP tests including the concurrent-debit race.
- **0d — Core boundary tooling:** `packages/core` package + ESLint guards (core cannot import `apps/*`; `service_role` client importable only from allowed dirs).
- **0e — Deploy topology:** connection pooler + read replica compose; monthly partition maintenance for `credit_ledger`/`audit_log`/`notifications`.
