# Page-Crawler Runbook

Autonomous pipeline that crawls all role surfaces, audits each page, documents the system, and
applies improvements in reviewed batches. Designed to run **unattended in bypass-permissions
mode**: relaunch Claude with permissions bypassed, then say **"run the crawl plan"**.

## Principles
- **Code is the source of truth.** Audit + docs + edits come from reading code.
- The dev server (`localhost:4400`, `pnpm --filter @heva/app dev`) is a **verify layer only** —
  used for the `[live]` rubric checks and to screenshot-prove Phase-3 fixes.
- **Safety:** audit before editing. Improvements commit **per role** with verification between
  batches, so every step has a clean rollback point.

## Inputs
- `scripts/crawl/routes.json` — 89 routes, role-classified, dynamic ones flagged.
  Regenerate with `node scripts/crawl/manifest.mjs`.
- `docs/audit/RUBRIC.md` — scoring axes + severity + per-page finding format.

## Order of execution
Process roles in this order (smallest/most-isolated first to validate the loop):
**affiliate → customer → staff → manager → admin.**

---

### Phase 1 — Audit (read-only, no edits)
For each route in `routes.json`:
1. **Code read**: `page.tsx` → component tree → the `lib/`/`data/` modules it consumes.
2. Score against `RUBRIC.md` axes 1, 2, 4(code parts), 7(code parts), 8.
3. For pages with `[live]` concerns, batch a dev-server pass: `preview_start` once, then per
   page `preview_snapshot` + `preview_screenshot` (1440 & 375 & dark) + `preview_console_logs`
   + `preview_network`. Resolve dynamic ids by visiting `discoverFrom` and grabbing the first
   real link.
4. Write `docs/audit/<role>/<slug>.md` per page (format in RUBRIC).
**Gate:** produce `docs/audit/INDEX.md` — a severity table across all pages. No code changed yet.

### Phase 2 — Documentation (read-only)
Generate from code + the audit:
- `docs/FEATURES.md` — feature catalog + **Feature↔Role matrix**, **Feature↔Feature flows**,
  **Feature↔Data map** (each feature → the `lib/`/`data/` modules it reads/writes).
- `docs/DATA-MODEL.md` — entities inferred from `data/*.ts` + `lib/*.ts` → proposed tables +
  API surface (the backend blueprint).
- `docs/PROJECT-GUIDE.md` — dev onboarding: stack, monorepo layout, role/cookie model, how to
  run, where data lives, conventions, how to add a page, Phase-0-mock philosophy.

### Phase 3 — Improve (edits, batched per role)
For each role, in execution order:
1. Take its `docs/audit/<role>/*` findings; apply **CRITICAL + HIGH** first, then MEDIUM as time allows.
2. Use `/design-review` for the designer's-eye / anti-template fixes on that role's pages.
3. Verify: `pnpm --filter @heva/app exec tsc --noEmit` + `pnpm --filter @heva/app test` +
   re-crawl the changed pages for screenshot proof of the `[live]` fixes.
4. Guard RBAC invariants: re-confirm money-blind manager surface against `lib/rbac.ts`.
5. **Commit** `fix(<role>): audit improvements` and checkpoint before the next role.

### Phase 4 — Reconcile
- Re-generate `FEATURES.md` / `DATA-MODEL.md` to reflect the improved state.
- Write `docs/audit/REPORT.md`: before/after scores per role, what changed, what was deferred and why.

## Stop / intervene conditions
- A verification step (tsc/test) fails and can't be fixed in 2 attempts → stop, report, do not commit.
- A fix would touch RBAC/money-visibility → make the change conservative and flag it in the report.
- More than ~15 files changed in a single role batch → pause and summarize before committing.
