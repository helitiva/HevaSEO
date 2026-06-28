# Page Audit Rubric

Every page is scored against these axes. **Code is the primary source of truth**; the live dev
server is used only where a check is marked **[live]** (something runtime reveals that static
reading cannot).

Each finding gets a severity: **CRITICAL** (data/RBAC leak, crash, broken core flow) ·
**HIGH** (real bug / blocked task / a11y blocker) · **MEDIUM** (maintainability, weak state
handling) · **LOW** (polish, copy, minor style).

## 1. Correctness & State Handling (code)
- [ ] Empty state handled (no data → intentional UI, not a blank/crash)
- [ ] Loading state handled
- [ ] Error state handled (`notFound()` / fallback, no silent swallow)
- [ ] No hardcoded values that should come from data/config
- [ ] Immutable update patterns (no in-place mutation of props/state)

## 2. RBAC & Data Exposure (code — cross-check `lib/rbac.ts`)
- [ ] Page's role matches what `rbac.ts` / nav config permits
- [ ] **Manager surface stays money-blind** (no salary/commission/payout/cost figures)
- [ ] `view` vs `act` impersonation respected (read-only where required)
- [ ] No customer PII or staff finance leaking into the wrong surface

## 3. Information Architecture & Hierarchy
- [ ] Clear primary action / focal point per screen
- [ ] Scale contrast creates hierarchy (not uniform emphasis) — [live] to confirm
- [ ] Intentional spacing rhythm, not uniform padding everywhere — [live]

## 4. Design Quality (anti-template — see global design-quality rules)
- [ ] Does not look like a default Tailwind/shadcn template
- [ ] Hover / focus / active states feel designed
- [ ] Demonstrates ≥4 required qualities (hierarchy, rhythm, depth, type, semantic color, motion…)

## 5. Responsive & Theming [live]
- [ ] No horizontal overflow at 375 / 768 / 1440
- [ ] Touch targets adequate on narrow widths
- [ ] Dark mode intentional (both themes if supported)

## 6. Runtime Health [live]
- [ ] No console errors/warnings on load
- [ ] No failed network requests
- [ ] No hydration mismatches

## 7. Accessibility
- [ ] Semantic landmarks (`header`/`nav`/`main`/`footer`) — code
- [ ] Headings ordered, controls labelled — code
- [ ] Color contrast adequate — [live]
- [ ] Keyboard navigable, visible focus — [live]

## 8. Performance (code, spot-check)
- [ ] No obvious N+1 / unbounded list render without virtualization where large
- [ ] Heavy libs dynamically imported
- [ ] Images sized (where applicable)

---

### Per-page finding format
```md
## <role> · <url>
**Source:** <path>  ·  **Verdict:** strong | ok | weak
### Pros
- ...
### Cons (severity-tagged)
- [HIGH] ...
- [MEDIUM] ...
### Recommended fixes (ordered)
1. ...
```
