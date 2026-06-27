# Staff My Day — Grouping, Filter & Search Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. TDD for the pure logic; verify the UI via tsc + vitest + curl on localhost:4400 (preview harness can't spawn here).

**Goal:** Make My Day fast to scan and act on when the board is busy — group the Focus list by urgency (Overdue / Due today / This week / Later) with section headers + counts, add status filter chips, and a search box (`/` to focus).

**Architecture:** All grouping/filter/search logic is pure and lives in `lib/myDay.ts` (unit-tested). `MyDayClient` gains `query` + `statusFilter` client state, renders a toolbar above the list, and groups the *visible* (filtered) tasks. Keyboard selection moves over the flattened visible list so j/k/enter/space still work across groups.

**Tech Stack:** Next 15 App Router, React 19, Tailwind + dashboard.css, vitest. Commands: `pnpm --filter @heva/app <cmd>`. No money on the staff surface.

---

## File Structure
- **Modify** `apps/app/src/lib/myDay.ts` — add `urgencyGroup`, `groupFocus`, `matchesQuery`, `filterFocus` (+ types).
- **Modify** `apps/app/src/lib/myDay.test.ts` — tests for the above.
- **Modify** `apps/app/src/components/staff/MyDayClient.tsx` — toolbar (search + chips), grouped render, `/` keyboard, selection over the visible list, no-match empty state.

---

## Task 1: Pure grouping + filter + search logic (TDD)

**Files:** Modify `apps/app/src/lib/myDay.ts`, `apps/app/src/lib/myDay.test.ts`

- [ ] **Step 1: Add failing tests** — append to `myDay.test.ts`:

```ts
import { urgencyGroup, groupFocus, matchesQuery, filterFocus } from './myDay';

describe('urgencyGroup', () => {
  it('buckets by days-to-due', () => {
    expect(urgencyGroup(-2)).toBe('overdue');
    expect(urgencyGroup(0)).toBe('today');
    expect(urgencyGroup(3)).toBe('week');
    expect(urgencyGroup(30)).toBe('later');
    expect(urgencyGroup(null)).toBe('later');
  });
});

describe('groupFocus', () => {
  it('returns only non-empty groups in urgency order', () => {
    const tasks = [t({ id: 'a', days: -1 }), t({ id: 'b', days: 0 }), t({ id: 'c', days: 2 })];
    const g = groupFocus(tasks);
    expect(g.map((x) => x.key)).toEqual(['overdue', 'today', 'week']);
    expect(g[0].items[0].id).toBe('a');
  });
});

describe('filter + search', () => {
  const tasks = [t({ id: 'a', code: 'CNT-1', service: 'Content', status: 'assigned' }), t({ id: 'b', code: 'BL-2', service: 'Backlink', status: 'in_progress' })];
  it('matchesQuery hits code, service, pkg (case-insensitive); empty matches all', () => {
    expect(matchesQuery(tasks[0], '')).toBe(true);
    expect(matchesQuery(tasks[0], 'cnt')).toBe(true);
    expect(matchesQuery(tasks[1], 'back')).toBe(true);
    expect(matchesQuery(tasks[0], 'zzz')).toBe(false);
  });
  it('filterFocus combines status + query', () => {
    expect(filterFocus(tasks, 'all', '').length).toBe(2);
    expect(filterFocus(tasks, 'in_progress', '').map((x) => x.id)).toEqual(['b']);
    expect(filterFocus(tasks, 'all', 'cnt').map((x) => x.id)).toEqual(['a']);
  });
});
```
(`t()` helper already exists in this test file.)

- [ ] **Step 2: Run, expect FAIL** — `pnpm --filter @heva/app exec vitest run src/lib/myDay.test.ts`

- [ ] **Step 3: Implement** — append to `myDay.ts`:

```ts
export type UrgencyKey = 'overdue' | 'today' | 'week' | 'later';
export interface FocusGroup { key: UrgencyKey; label: string; items: MyDayTask[]; }

const GROUP_ORDER: { key: UrgencyKey; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'This week' },
  { key: 'later', label: 'Later' },
];

export function urgencyGroup(days: number | null): UrgencyKey {
  if (days === null) return 'later';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  return 'later';
}

// Non-empty urgency groups, in order. Items keep the caller's sort.
export function groupFocus(tasks: MyDayTask[]): FocusGroup[] {
  return GROUP_ORDER
    .map(({ key, label }) => ({ key, label, items: tasks.filter((t) => urgencyGroup(t.days) === key) }))
    .filter((g) => g.items.length > 0);
}

export function matchesQuery(t: MyDayTask, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return t.code.toLowerCase().includes(s) || t.service.toLowerCase().includes(s) || t.pkg.toLowerCase().includes(s);
}

export function filterFocus(tasks: MyDayTask[], status: 'all' | OrderStatus, q: string): MyDayTask[] {
  return tasks.filter((t) => (status === 'all' || t.status === status) && matchesQuery(t, q));
}
```

- [ ] **Step 4: Run, expect PASS.** **Step 5: Commit** `git commit -m "feat(staff): myDay grouping/filter/search pure logic + tests"`

---

## Task 2: Toolbar + grouped render + keyboard in MyDayClient

**Files:** Modify `apps/app/src/components/staff/MyDayClient.tsx`

- [ ] **Step 1: Add imports + state.** Import `groupFocus`, `filterFocus`, plus `statusLabel` from `@/data/staffMock` and `OrderStatus` type. Add a ref for the search input. Add state:

```tsx
const [query, setQuery] = useState('');
const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
const searchRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 2: Derive visible + groups.** Replace the single `state.focus` render source:

```tsx
const visible = filterFocus(state.focus, statusFilter, query);
const groups = groupFocus(visible);
const STATUS_CHIPS: Array<{ key: 'all' | OrderStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'assigned', label: statusLabel.assigned },
  { key: 'in_progress', label: statusLabel.in_progress },
  { key: 'changes_requested', label: statusLabel.changes_requested },
];
```

- [ ] **Step 3: Selection over the visible list.** Change keyboard + actions to index `visible` instead of `state.focus`, and add `/` to focus search:

```tsx
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    if (e.key === '/' && !typing && !submitId) { e.preventDefault(); searchRef.current?.focus(); return; }
    if (submitId || typing) return;
    const max = visible.length - 1;
    if (e.key === 'j') { e.preventDefault(); setSel((i) => Math.min(i + 1, max)); }
    else if (e.key === 'k') { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && visible[sel]) router.push(`/staff/tasks/${visible[sel].id}`);
    else if (e.key === ' ' && visible[sel]) { e.preventDefault(); act(visible[sel].id); }
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [visible, sel, submitId]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Render toolbar + groups.** Inside the focus `kcard`, after the "Focus today" header row, add the toolbar, then replace the flat `<ul>` with grouped rendering. The row markup is unchanged except its selected-state compares against the flat visible index. Extract the existing row JSX into a `<Row>` local component or inline it per group with a running index.

Toolbar:

```tsx
<div className="mb-3 flex flex-wrap items-center gap-2">
  <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
    <i className="ph-bold ph-magnifying-glass text-muted-foreground" aria-hidden />
    <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search my tasks…  (press /)"
      className="w-full bg-transparent outline-none" aria-label="Search my tasks" />
    {query && <button onClick={() => setQuery('')} aria-label="Clear search"><i className="ph-bold ph-x text-muted-foreground" /></button>}
  </div>
  <div className="flex flex-wrap gap-1">
    {STATUS_CHIPS.map((c) => {
      const n = c.key === 'all' ? state.focus.length : state.focus.filter((t) => t.status === c.key).length;
      return (
        <button key={c.key} onClick={() => setStatusFilter(c.key)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${statusFilter === c.key ? 'bg-primary text-primary-foreground' : 'border border-border hover:border-primary/50'}`}>
          {c.label} <span className="opacity-70">{n}</span>
        </button>
      );
    })}
  </div>
</div>
```

Grouped list (replaces the flat `<ul>`), keeping a flat running index `fi` for selection parity with the keyboard:

```tsx
{visible.length === 0 ? (
  <EmptyOrNoMatch everHadTasks={everHadTasks} cleared={kpis.cleared} filtered={state.focus.length > 0} onClear={() => { setQuery(''); setStatusFilter('all'); }} />
) : (
  (() => { let fi = -1; return groups.map((g) => (
    <div key={g.key} className="mb-1">
      <p className="px-1 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.label} · {g.items.length}</p>
      <ul className="divide-y divide-border/60">
        {g.items.map((task) => { fi += 1; return <Row key={task.id} task={task} index={fi} />; })}
      </ul>
    </div>
  )); })()
)}
```

Where `Row` is the existing row markup extracted to a local component closing over `sel`, `act`, `copyLink`, `flash`, `makeId` (define inside `MyDayClient` so it sees them), using `index === sel` for the ring. `EmptyOrNoMatch` shows the existing `EmptyState` when nothing is filtered, or a "No tasks match — Clear filters" card when filters hid everything.

- [ ] **Step 5: Type-check + tests + curl.**

```bash
pnpm --filter @heva/app exec tsc --noEmit          # 0 errors
pnpm --filter @heva/app test                       # all green
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4400/staff   # 200
curl -s http://localhost:4400/staff | grep -oiE "Search my tasks|Overdue ·|Due today ·|All <" | head
```

- [ ] **Step 6: Commit** `git commit -m "feat(staff): My Day urgency groups + status filter chips + search"`

---

## Self-Review
- **Coverage:** grouping (Task 1 `groupFocus` + Task 2 render) ✓ · filter chips (Task 1 `filterFocus` + Task 2 chips with counts) ✓ · search + `/` (Task 1 `matchesQuery` + Task 2 input/keyboard) ✓ · keyboard parity across groups (Task 2 flat `fi` index + `visible`-based nav) ✓ · no-match empty (Task 2 `EmptyOrNoMatch`) ✓.
- **Type consistency:** `UrgencyKey`/`FocusGroup` defined Task 1, consumed Task 2; `filterFocus(tasks, 'all'|OrderStatus, q)` signature matches the chip/keyboard call sites; `MyDayTask` unchanged.
- **No placeholders:** every step has concrete code/commands.

## NOT in scope
Row-peek (inline brief preview), availability toggle + next-due on the header, right-rail cockpit (customers + notifications) — deferred per the scope decision.
