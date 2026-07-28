# HevaSEO — Database (Supabase)

Local mirror of the production stack (Postgres 17 + Auth + Storage + Realtime).
Managed Supabase is the deploy target (ADR C1); local matches its PG major version.

## Daily loop

```bash
pnpm db:start        # boot the local stack (Docker) — once per session
pnpm db:new <name>   # scaffold a new timestamped migration in migrations/
pnpm db:test         # fast inner loop: run pgTAP tests against current DB
pnpm verify:db       # the GATE: db reset (re-apply migrations + seed) + pgTAP
pnpm db:stop         # shut the stack down
```

`pnpm verify:db` (= `db reset` + `test db`) is the gate every schema/RLS/function
change must keep green. Write the pgTAP test in `tests/` first, watch it fail,
then add the migration in `migrations/`.

> **Speed note:** `db reset` ends with a slow "Restarting containers" step (can
> exceed a few minutes). Use `pnpm db:test` as the fast inner TDD loop; run the
> full `pnpm verify:db` before committing a slice.

> **Gotcha:** write migration SQL with an editor/Write, not a shell heredoc that
> shares a block with a long-running command — an interrupted block can leave the
> migration file empty while `db reset` still records it as applied.

## Layout

| Path | Purpose |
|---|---|
| `config.toml` | Supabase CLI config (ports, pg version, stack toggles) |
| `migrations/`  | Timestamped SQL, applied in order. Never edit a committed migration — add a new one. |
| `tests/`       | pgTAP test files (`*_test.sql`), run by `supabase test db`. |
| `seed.sql`     | Product config + default tenant, applied after migrations on reset. |

## Conventions (from ADR-backend.md)

- Primary keys: `uuid default gen_random_uuid()` (pgcrypto).
- Every business table carries `tenant_id` (K5) and indexes RLS-predicate columns.
- Money-blind roles read via money-stripped VIEWS, not base tables (K9).
- Sensitive writes go through `SECURITY DEFINER` functions, not direct UPDATEs (K2).
- RLS is the source of truth; the app connects with the user's JWT, never
  `service_role` except the webhook handler, the worker, and migration/seed.

See `docs/ADR-backend.md` (architecture) and `docs/superpowers/plans/2026-06-16-phase0a-db-foundation.md` (this phase).
