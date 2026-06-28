# Audit — Customer portal surface (17 routes)

Code-read audit against [RUBRIC.md](./RUBRIC.md). `[live]` items need a dev-server pass.

Data spine: `data/mock.ts` (ORDERS, PROJECTS, ACTIVITY, SERVICES, INVOICES, CREDIT_BALANCE) ·
`data/docsStore.ts` + `data/staffDocs.ts` (audience-gated docs) ·
`data/notesStore.ts` (localStorage-backed, customer-namespaced) ·
`data/notesStore.ts` + `data/staffNotes.ts` (SEED_NOTES shared with staff) ·
`components/OrdersStore.tsx`, `components/CreditStore.tsx`, `components/ProjectsStore.tsx` (in-memory React context) ·
`components/broadcast/InboxClient.tsx` (shared with all roles) ·
`lib/sanitizeHtml.ts` (notes + docs HTML gate) ·
`lib/impersonation.ts` (cookie-based admin→customer impersonation) · `lib/portalBase.ts` (path-based portal detection).

---

## customer · / (root redirect) · Verdict: ok
**Source:** `app/page.tsx`
### Pros
- Single-statement `redirect('/dashboard')` — correct, zero dead code.
### Cons
- [LOW] No metadata (`metadata` export) on the redirect page — irrelevant for the tab title but breaks if bots land on `/`.
### Recommended fixes
1. Nothing blocking; add `export const metadata = { title: 'HevaSEO' }` if crawlers matter.

---

## customer · /dashboard · Verdict: ok (two findings worth fixing)
**Source:** `app/(portal)/dashboard/page.tsx` · `components/DashboardTop.tsx`
### Pros
- `DashboardTop` derives order counts, service mix, and segmented bar from the live store — no hardcoded KPIs.
- Date-range selector persists across renders via local state; empty-range case handled (`'No orders in this range'` text in legend).
### Cons
- [HIGH] `const TODAY = new Date('2026-06-25T00:00:00')` is **module-scope** in `DashboardTop.tsx`. The date-range filter (`range=7/30/90 days`) compares every order date against this frozen anchor. In production the window would silently stop advancing — orders added after boot would appear in "Last 7 days" forever, or fall off it. Must become `new Date()` called inside the render/memo.
- [HIGH] On-time completion rate KPI (`96%` all-time, `100%` this-week, mini-bar heights) is **entirely hardcoded** in JSX. It presents as a live metric but never updates.
- [MEDIUM] `ACTIVITY` feed uses `dangerouslySetInnerHTML={{ __html: a.html }}`. The HTML comes from `data/mock.ts` (a static author-controlled array), so there is no XSS vector today. However the pattern makes it easy to accidentally wire user-supplied HTML here in future; log it as a pattern debt. `aria-hidden` also missing on the icon `<i>` in each activity row.
- [MEDIUM] "Hi Huy 👋" and "updated 2 minutes ago" are hardcoded copy — must become a real username and a live `updatedAt` timestamp.
- [LOW] Decorative `<i className="ph-…">` icons throughout lack `aria-hidden` (systemic).
### Recommended fixes
1. Replace `const TODAY = new Date(…)` with `useMemo(() => new Date(), [])` or compute inline.
2. Derive on-time % from actual order data; delete the hardcoded JSX block.
3. Wire username and "updated" timestamp to a real session/context.
4. Add `aria-hidden="true"` to all decorative `<i>` icons (surface-wide fix).

---

## customer · /orders · Verdict: strong
**Source:** `app/(portal)/orders/page.tsx` · `components/OrdersBoard.tsx`
### Pros
- `OrdersBoard` is the most capable component in this surface: Kanban + List + Table views, per-user column presets persisted to `localStorage`, `OrderDetailPanel` via portal, drag-and-drop status changes, date-range filters all wired correctly to the store.
- Both views handle empty columns/lists gracefully (empty column cells in Kanban, "No orders" empty state in list).
- `metadata = { title: 'Orders' }` present.
### Cons
- [MEDIUM] Board uses `localStorage` for view/column/density prefs keyed on generic strings (`heva.cardTemplate`, `heva.boardView`, etc.) with no per-role namespace. An admin impersonating a customer would share these prefs. Low impact in Phase-0 but a quirk to clean up.
- [LOW] `OrdersBoard` is a very large client component (>400 lines); could be split — note for maintainability, not a blocking issue.
- [LOW] `[live]` confirm kanban drag-over styling is keyboard-accessible.
### Recommended fixes
1. Namespace `localStorage` keys with the portal role (e.g., `heva.customer.cardTemplate`).

---

## customer · /projects · Verdict: strong
**Source:** `app/(portal)/projects/page.tsx` (full `'use client'` page)
### Pros
- Three distinct empty states (empty folder, no-match filter, zero projects) with correct contextual messaging and call-to-actions.
- Drag-and-drop project → folder with visual `drop-hot` feedback; folder nesting (one level) rendered correctly.
- Derived `filtered` via `useMemo`; `focusDomain` URL-param drives search on mount (clean `useEffect` with proper deps).
- CRUD round-trip (create/edit/delete project + folder) uses shared `ProjectsStore` context — changes appear on the project detail page immediately.
### Cons
- [HIGH] **Missing `metadata` export** on `/projects`. Browser tab shows blank title (or inherits the layout default if one exists).
- [MEDIUM] `favColor` / `initials` helper functions and `STATUS_PILL` constant are copy-pasted identically into `projects/[id]/page.tsx` — DRY violation, diverge risk.
- [LOW] `Suspense fallback={null}` — the page renders nothing during the `useSearchParams` suspend. A skeleton or loading indicator would improve perceived performance.
- [LOW] Decorative `<i>` icons lack `aria-hidden` throughout.
### Recommended fixes
1. Add `export const metadata = { title: 'Projects' }`.
2. Extract `favColor`, `initials`, `STATUS_PILL` into a shared `lib/projectUtils.ts`.
3. Replace `Suspense fallback={null}` with a page skeleton.

---

## customer · /projects/[id] · Verdict: ok
**Source:** `app/(portal)/projects/[id]/page.tsx`
### Pros
- Not-found state handled with graceful message and back-link.
- Stats (`totalCost`, per-status counts) derived from the live `OrdersStore` + `ORDERS` combined slice — correctly includes user-added orders.
- `a[rel="noopener noreferrer"]` on the external domain link.
### Cons
- [MEDIUM] **No `metadata` / `generateMetadata`** — browser tab shows nothing. Dynamic title `${project.domain}` would be appropriate here.
- [MEDIUM] `totalCost` shows the sum of all order costs for the project including mock data. When backend lands, this must be scoped to the authenticated customer's orders only (not all orders that share the domain).
- [MEDIUM] `favColor` + `initials` duplicated from `/projects` page — see above.
- [LOW] `'use client'` page using `useParams()` — correct for RSC interop, but `generateMetadata` cannot run here because the whole page is client-side. Consider making the shell a Server Component and the interactive parts client islands.
### Recommended fixes
1. Add `generateMetadata` (requires converting the wrapper to a Server Component).
2. Scope `totalCost` to the authenticated customer at backend time.

---

## customer · /services · Verdict: strong
**Source:** `app/(portal)/services/page.tsx`
### Pros
- "Available" vs "Soon" differentiation is data-driven (`!!SERVICE_CATALOG[k]`) — adding a service catalog entry automatically enables it.
- Disabled "Soon" cards are non-interactive (`<div>` not `<Link>`) and visually muted — good UX pattern.
- `metadata = { title: 'Services' }` present.
### Cons
- [LOW] Decorative service icons lack `aria-hidden`.
### Recommended fixes
1. Add `aria-hidden="true"` to all decorative `<i>` icons.

---

## customer · /services/[svc] · Verdict: strong
**Source:** `app/(portal)/services/[svc]/page.tsx` · `data/services.ts`
### Pros
- `generateMetadata` wired correctly — tab title reflects the service.
- Graceful "coming soon" fallback when `getCatalog` returns null — no crash on unlisted slug.
- Breadcrumb present; `ServiceOrder` component handles plan selection and order submission.
### Cons
- [MEDIUM] `notFound()` is never called for an entirely unknown slug (not in SERVICES, not in catalog). The UI renders with fallback label `'Service'` and the "coming soon" state — acceptable but semantically wrong; a 404 would be more correct.
- [LOW] `[live]` confirm `ServiceOrder` validation feedback when project/plan not selected.
### Recommended fixes
1. Call `notFound()` when `svc` is not a key of `SERVICES` at all (unknown route).

---

## customer · /credit · Verdict: strong
**Source:** `app/(portal)/credit/page.tsx` · `components/CreditClient.tsx`
### Pros
- Balance, month spend, runway, and service-mix all derived from `CreditStore` transactions — adaptive (runway shows "No spend yet" when no orders).
- Transaction detail modal and invoice detail modal are well-structured with correct empty-state copy.
- `curMonth` computed from the latest real transaction date (not from hardcoded `new Date()`) — avoids the `DashboardTop.TODAY` pitfall.
- `metadata = { title: 'Credit & Invoices' }` present.
### Cons
- [MEDIUM] `"Balance after"` in the transaction modal always shows the _current_ live balance (`balance` from store), not the balance at the time of that specific transaction. For any non-last transaction this is incorrect.
- [MEDIUM] `Tax ID 0312345678` hardcoded in the "Billing information" card — it's also in the `usePersistedForm` defaults in `SettingsView`. Needs a single source.
- [LOW] Invoice `amount` field in table renders as `$${inv.amount}` (no `.toLocaleString`) — inconsistent with the detail modal and the balance display.
- [LOW] `"sample data"` footer disclaimer is acceptable for Phase-0 but must be removed before launch.
### Recommended fixes
1. Track running balance per transaction at write time (or compute it on read from sorted history).
2. Derive billing details from a customer profile context, not duplicated defaults.

---

## customer · /inbox · Verdict: ok (consistency gap)
**Source:** `app/(portal)/inbox/page.tsx` · `components/broadcast/InboxClient.tsx`
### Pros
- `metadata = { title: 'Inbox' }` present.
- Audience-gated: `InboxClient` receives `role="customer"` (or derives it) to filter broadcasts.
### Cons
- [MEDIUM] No `PageHeader` / page-level `<h1>` is rendered — the page delegates entirely to `<InboxClient />` which starts directly with content. `[live]` confirm the component itself renders a heading.
- [LOW] `[live]` confirm empty-inbox state (no unread broadcasts) shows a meaningful message, not a blank box.
### Recommended fixes
1. Read `InboxClient` to verify it renders a `<h1>` heading; if not, add a wrapper header in the page.

---

## customer · /docs · Verdict: strong
**Source:** `app/(portal)/docs/page.tsx` · `components/docs/DocsLibrary.tsx`
### Pros
- `DocsLibrary audience="customer"` feeds through `docsForCustomer(docs)` — the audience gate is at the data layer, not the render layer. A doc not distributed to `customer` never reaches this surface.
- Both seed docs (from `docsStore`) and admin-published docs (from the live store) are visible after hydration; `ready` flag handles the loading state.
- Semantic `<section>` + `<header>` + `<h1>` structure; `metadata` present.
### Cons
- [LOW] `[live]` confirm `DocsClient` (the shared inner component) handles the empty-library state when no docs are distributed to customers.
### Recommended fixes
1. Verify `DocsClient` has an empty-library state; add one if missing.

---

## customer · /docs/[id] · Verdict: strong
**Source:** `app/(portal)/docs/[id]/page.tsx` · `components/docs/DocReaderClient.tsx`
### Pros
- `DocReaderClient audience="customer"` calls `docForCustomer` — a doc not distributed to the customer audience returns `null` and renders "Doc not found / not shared with you" — **existence of other audiences' docs does not leak**.
- `!ready` (loading) state shows a spinner; not-found state has a back-link.
- Admin-authored `doc.html` is rendered via `dangerouslySetInnerHTML` but the comment confirms it was **sanitized at save time** via `sanitizeHtml` in `DocComposer`.
### Cons
- [MEDIUM] **No `generateMetadata`** — browser tab shows nothing for a specific doc. Dynamic `title: doc.title` would be natural here.
- [LOW] The `<i aria-hidden />` pattern is correctly set on the back-link icon (`aria-hidden` present in `DocReaderClient` line 31) — good, but check rest of `DocArticle`.
### Recommended fixes
1. Add `generateMetadata` (requires converting to a Server Component that reads the doc by ID + audience server-side).

---

## customer · /notes · Verdict: ok
**Source:** `app/(portal)/notes/page.tsx` → `app/staff/notes/NotesClient.tsx`
### Pros
- Notes are namespaced in `localStorage` by portal path (`notesKey()` returns `'heva:customer:notes:v1'` when on a `/` path outside `/admin|/manager|/staff`) — customer and staff notebooks don't collide.
- `metadata = { title: 'Notes' }` present.
### Cons
- [HIGH] **Cross-surface seed data leak**: `notesStore.ts` seeds with `SEED_NOTES` from `data/staffNotes.ts` on first load (when no `localStorage` key exists). The seed notes are authored for _staff_ context ("client briefing", "backlink checklist"). A new customer who has never written a note sees staff-flavored placeholder content. The customer surface should have its own seed or start empty.
- [MEDIUM] Customer `/notes` page **reuses the staff `NotesClient` directly** (same import path). Any staff-specific UI elements in that component (skill chips, staff-only labels) will appear in the customer notebook.
- [LOW] `[live]` confirm the `NotesClient` empty state (after deleting all notes) is appropriate for a customer context.
### Recommended fixes
1. Create a customer-scoped seed (`SEED_CUSTOMER_NOTES`) or default to empty array for the customer key.
2. Either audit `NotesClient` for staff-only UI or create a `CustomerNotesClient` wrapper that suppresses staff-specific elements.

---

## customer · /notes/new · Verdict: ok
**Source:** `app/(portal)/notes/new/page.tsx` → `app/staff/notes/NoteFullEditor.tsx`
### Pros
- `cleanDraft` in `NoteComposer` calls `sanitizeHtml(d.body)` before persisting — HTML is sanitized at the boundary.
- `portalBase` detected from pathname: back-links return to `/notes` (customer) not `/staff/notes`.
### Cons
- [MEDIUM] **No `metadata` export** — browser tab shows nothing.
- [LOW] `[live]` confirm the editor toolbar doesn't surface staff-only elements.
### Recommended fixes
1. Add `export const metadata = { title: 'New note' }`.

---

## customer · /notes/[id] · Verdict: ok
**Source:** `app/(portal)/notes/[id]/page.tsx` → `app/staff/notes/NoteFullReader.tsx`
### Pros
- `NoteFullReader` uses `useNote(id)` which reads from the portal-namespaced `localStorage` key; a customer note ID will not accidentally resolve to a staff note.
- Not-found state returns a back-link.
### Cons
- [MEDIUM] **No `generateMetadata` or `metadata`** — dynamic page, no tab title.
- [MEDIUM] `NoteFullReader` renders `doc.html` via `dangerouslySetInnerHTML={{ __html: note.body }}`. The body is sanitized at save time via `cleanDraft → sanitizeHtml`, so for notes created through the editor this is safe. **But** `SEED_NOTES` stores plain-text in `.body`; if any seed note were to contain unescaped HTML it would bypass sanitization. Audit the seed data.
### Recommended fixes
1. Add `generateMetadata` (requires converting to Server Component or reading title from store).
2. Verify `SEED_NOTES` bodies contain no raw HTML; or pass all seed bodies through `sanitizeHtml` at seed-read time.

---

## customer · /notes/[id]/edit · Verdict: ok
**Source:** `app/(portal)/notes/[id]/edit/page.tsx` → `app/staff/notes/NoteFullEditor.tsx`
### Pros
- Uses same `NoteFullEditor` as `/notes/new` with `id` prop — edit path saves correctly to existing note via `mutate`.
- `cleanDraft` sanitizes on save.
### Cons
- [MEDIUM] **No `metadata` export** — browser tab shows nothing.
- [LOW] `[live]` confirm the page renders a "not found" / redirect when `id` is not in the customer's note list.
### Recommended fixes
1. Add `export const metadata = { title: 'Edit note' }`.

---

## customer · /support · Verdict: ok
**Source:** `app/(portal)/support/page.tsx` · `components/SupportClient.tsx`
### Pros
- Ticket CRUD in local state; empty-ticket state is implicitly handled (table renders nothing when list is empty — the open count pill shows `0 open`).
- SLA table is honest about business hours; "Advisors online now" pill is decorative but clearly labelled.
- `metadata = { title: 'Support' }` present.
### Cons
- [HIGH] **`http://localhost:4330/#faq`** is hardcoded as the href for every FAQ link in the sidebar. This will 404 in staging/production.
- [MEDIUM] `SEED_TICKETS` is module-scope — fine for Phase-0 but means ticket data is the same for every session / user until `localStorage` is wired.
- [MEDIUM] Reply submission (`onSubmit`) calls `toast('Reply sent')` then immediately `close()`, discarding the reply text without persisting it. The ticket's `updated` timestamp and status also don't update after a reply.
- [LOW] `ticketThread` constructs a static two-message thread regardless of real history — needs a real thread model.
### Recommended fixes
1. Replace `localhost:4330` with an env-var or relative `/faq` path.
2. On reply submit: update the ticket's `updated` field + status to `In progress` in local state.

---

## customer · /settings · Verdict: ok
**Source:** `app/(portal)/settings/page.tsx` · `components/SettingsView.tsx`
### Pros
- Profile and billing forms persist to `localStorage` via `usePersistedForm` — values survive navigation.
- Password change form calls `updatePassword` with toast feedback; security tab disables 2FA toggle visually.
- `metadata = { title: 'Settings' }` present.
### Cons
- [HIGH] `apiKey` default is `'sk_live_••••••••••••••••8f2a'` — even though it's masked, this is in the client bundle. In production, the real API key must never be in initial state; fetch it from the server or render as `••••` with a copy-on-reveal flow.
- [MEDIUM] Billing details (`taxId: '0312345678'`) duplicated from `CreditClient.tsx` — inconsistent display if one is updated but not the other.
- [MEDIUM] `'sample data'` footer (`HevaSEO Workspace · Settings · sample data`) must be removed before launch.
- [LOW] Plan upgrade (`setPlan`) persists only to React state, not `localStorage` — resets on refresh.
### Recommended fixes
1. Never seed `apiKey` with a real-looking key string; use `null` and fetch on demand server-side.
2. Single-source billing details in a customer context or server profile.
3. Persist plan selection to `localStorage` alongside the profile form.

---

## Surface summary

**Strengths:**
- Audience gating on docs is clean and enforced at the data layer — customer can't see staff/manager docs even if they guess IDs.
- Notes are correctly namespaced per portal surface; the sanitizer fires at the save boundary in both the notes editor and the doc composer.
- `OrdersBoard` and `ProjectsStore` deliver a genuinely rich, interactive experience with proper empty, loading, and derived states.
- Service catalog pattern (data-driven availability) is a model worth replicating.

**Systemic issues:**
1. **Hardcoded `TODAY`** in `DashboardTop` freezes all date-range filters at the process start time.
2. **Missing `metadata`** on `/projects`, `/projects/[id]`, `/docs/[id]`, `/notes/new`, `/notes/[id]`, `/notes/[id]/edit` — six routes with no browser tab title.
3. **Staff `SEED_NOTES` seeded into customer notebook** — wrong persona content on first visit.
4. **Decorative `<i>` icons without `aria-hidden`** throughout the surface (systemic, matching the affiliate finding).
5. **`localhost:4330`** URL hardcoded in `SupportClient` FAQ links.

**Top Phase-3 fixes (ordered):**
1. Replace `DashboardTop.TODAY` with a live clock; remove the hardcoded `96%` on-time KPI.
2. Add `generateMetadata` to the six missing routes.
3. Customer-scoped note seed (or empty default) to avoid staff-flavored placeholder content.
4. Fix `localhost:4330` FAQ href in `SupportClient`.
5. `apiKey` in `SettingsView` must not be seeded with a key-shaped string.
6. Audit `NotesClient` + `NoteFullReader`/`NoteFullEditor` for staff-only UI elements leaking into the customer notebook.

**Backend notes for DATA-MODEL:**

| Entity | Required live queries |
|---|---|
| Customer | Profile (name, email, phone, company, industry, website), plan/tier |
| BillingProfile | taxId, company, address — single source for Settings + CreditClient |
| CreditAccount | balance, transactions (type, amount, date, description, status) |
| Invoice | no, date, amount, status, PDF URL |
| Order | all order fields scoped to `customerId`; `statusOverrides` → live order status |
| Project | scoped to `customerId`; folder hierarchy |
| Folder | scoped to `customerId` |
| SupportTicket | scoped to `customerId`; thread messages with timestamps |
| Note | scoped to `customerId` (replaces localStorage) |
| Broadcast/Doc | audience-gated reads — `docsForCustomer`, `inboxForCustomer` must become DB queries |
| Session | `apiKey` must be fetched from server, never in bundle |
| ActivityFeed | real events replacing the static `ACTIVITY` array |

`ACTIVITY` feed, on-time %, "updated 2 minutes ago", and specialist assignment must all become live queries in Phase-3.
