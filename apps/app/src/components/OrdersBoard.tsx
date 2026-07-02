'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import {
  ORDERS, SERVICES, STATUSES, projectForDomain, folderPathForDomain, managerFor, STAFF_ROLE,
  type Order, type OrderStatus, type ServiceKey,
} from '@/data/mock';
import { useOrdersStore } from './OrdersStore';

const COLS: OrderStatus[] = ['planned', 'progress', 'review', 'completed'];

/** Card layouts: same info, different emphasis. (Priority is admin-only, so no priority layout.) */
type CardTemplate = 'balanced' | 'project' | 'progress';

const TEMPLATES: { key: CardTemplate; label: string; desc: string }[] = [
  { key: 'balanced', label: 'Balanced',       desc: 'Even hierarchy (default)' },
  { key: 'project',  label: 'Project first',  desc: 'Domain is the headline' },
  { key: 'progress', label: 'Progress first', desc: 'Big % to track delivery' },
];

/** How much each card shows, independent of the emphasis template. */
type CardDensity = 'compact' | 'standard' | 'detail';
const DENSITIES: { key: CardDensity; label: string }[] = [
  { key: 'compact', label: 'Compact' },
  { key: 'standard', label: 'Standard' },
  { key: 'detail', label: 'Detail' },
];

const STORAGE_KEY = 'heva.cardTemplate';
const STORAGE_KEY_DENSITY = 'heva.cardDensity';
const STORAGE_KEY_COLS = 'heva.listColumns';
const STORAGE_KEY_VIEW = 'heva.boardView';

const DATE_RANGES = [
  { days: 0, label: 'All time' },
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];
const parseUS = (d: string): number | null => {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(+m[3], +m[1] - 1, +m[2]).getTime() : null;
};

/** List-view columns the user can show/hide and reorder. */
type ColId = 'no' | 'code' | 'service' | 'domain' | 'project' | 'folder' | 'staff' | 'manager' | 'status' | 'progress' | 'eta';
const COL_LABEL: Record<ColId, string> = {
  no: 'No.', code: 'Code', service: 'Order / Service', domain: 'Domain', project: 'Project', folder: 'Folder',
  staff: 'Staff', manager: 'Manager', status: 'Status', progress: 'Progress', eta: 'ETA',
};
const COL_ALIGN: Partial<Record<ColId, 'center' | 'right'>> = { no: 'center', eta: 'right' };
const DEFAULT_COLS: ColId[] = ['no', 'code', 'service', 'domain', 'project', 'folder', 'staff', 'manager', 'status', 'progress', 'eta'];

/** One-click table layouts — `cols` are the visible columns, in order. */
const PRESETS: { key: string; label: string; desc: string; icon: string; cols: ColId[] }[] = [
  { key: 'default', label: 'Default', desc: 'Every column', icon: 'ph-table', cols: DEFAULT_COLS },
  { key: 'compact', label: 'Compact', desc: 'Just the essentials', icon: 'ph-rows', cols: ['no', 'code', 'service', 'status', 'eta'] },
  { key: 'tracking', label: 'Delivery tracking', desc: 'Staff · manager · status · progress', icon: 'ph-gauge', cols: ['no', 'service', 'staff', 'manager', 'status', 'progress', 'eta'] },
  { key: 'project', label: 'By project', desc: 'Project & folder focus', icon: 'ph-folders', cols: ['no', 'code', 'service', 'project', 'folder', 'status', 'eta'] },
];

function pct(o: Order) {
  return o.progress ?? (o.status === 'completed' ? 100 : o.status === 'review' ? 95 : 8);
}

/** First two initials of a staff name, e.g. "Daniel Brooks" → "DB". */
function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

/** Assigned staff: initials avatar + name + job title. Shared by cards and the list table. */
function StaffTag({ name, role, className = '' }: { name: string; role?: string; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">{initials(name)}</span>
      <span className="min-w-0 truncate">{name}{role && <span className="text-muted-foreground"> · {role}</span>}</span>
    </span>
  );
}

/** Manager in charge: amber avatar + name + "Manager" title + a tag that flips to "Reviewing" in review. */
function ManagerTag({ name, reviewing, className = '' }: { name: string; reviewing: boolean; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-500/15 text-[9px] font-bold text-amber-600" title="Manager in charge">{initials(name)}</span>
      <span className="min-w-0 truncate">{name}<span className="text-muted-foreground"> · Manager</span></span>
      {reviewing && <span className="shrink-0 whitespace-nowrap rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">Reviewing</span>}
    </span>
  );
}

/** Per-column <td> classes for the list table (used with the column manager). */
const LIST_TD: Record<ColId, string> = {
  no: 'px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground',
  code: 'whitespace-nowrap px-3 py-2.5 align-middle',
  service: 'px-3 py-2.5',
  domain: 'whitespace-nowrap px-3 py-2.5 text-muted-foreground',
  project: 'whitespace-nowrap px-3 py-2.5',
  folder: 'whitespace-nowrap px-3 py-2.5',
  staff: 'whitespace-nowrap px-3 py-2.5',
  manager: 'whitespace-nowrap px-3 py-2.5',
  status: 'px-3 py-2.5',
  progress: 'px-3 py-2.5',
  eta: 'whitespace-nowrap px-3 py-2.5 text-right font-semibold',
};

/** Renders one list-table cell for a given column. */
function listCell(id: ColId, o: Order, i: number, est: OrderStatus): ReactNode {
  switch (id) {
    case 'no': return i + 1;
    case 'code': return (
      <>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/70">#{o.id}</span>
        <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><i className="ph-bold ph-calendar-blank text-muted-foreground/70" aria-hidden /> {o.date}</span>
      </>
    );
    case 'service': return (
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><i className={`ph-bold ${SERVICES[o.service].icon}`} aria-hidden /></span>
        <div className="min-w-0"><p className="truncate font-semibold leading-tight">{o.title}</p><p className="truncate text-[11px] text-muted-foreground">{o.sub}</p></div>
      </div>
    );
    case 'domain': return o.domain;
    case 'project': {
      const pr = projectForDomain(o.domain);
      return pr
        ? <span className="inline-flex items-center gap-1.5"><i className="ph-bold ph-stack text-muted-foreground" aria-hidden />{pr.name}</span>
        : <span className="text-muted-foreground">—</span>;
    }
    case 'folder': {
      const path = folderPathForDomain(o.domain);
      const leaf = path[path.length - 1];
      return leaf
        ? <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: leaf.color }}><i className="ph-bold ph-folder" aria-hidden />{leaf.name}</span>
        : <span className="text-muted-foreground">—</span>;
    }
    case 'staff': return <StaffTag name={o.owner} role={STAFF_ROLE[o.service]} />;
    case 'manager': return est === 'planned'
      ? <span className="inline-flex items-center gap-1.5 text-muted-foreground"><i className="ph-bold ph-user-circle-dashed" aria-hidden /> Not assigned</span>
      : <ManagerTag name={managerFor(o.id)} reviewing={est === 'review'} />;
    case 'status': return <span className="pill" style={{ background: `${STATUSES[est].color}1f`, color: STATUSES[est].color }}>● {STATUSES[est].label}</span>;
    case 'progress': return <span className="bar inline-block w-24 align-middle"><i style={{ width: `${pct(o)}%` }} /></span>;
    case 'eta': return o.eta;
  }
}

/** A "Done" badge for completed orders — sits top-left. (Priority is admin-only, not shown here.) */
function DoneBadge({ done }: { done: boolean }) {
  if (!done) return null;
  return <span className="pill pill-good">Done</span>;
}

/** Compact meta block: project + website·URLs on two lines. */
function MetaRows({ o, hideProject = false }: { o: Order; hideProject?: boolean }) {
  const proj = projectForDomain(o.domain);
  const website = o.multiWeb ? 'Multi-site' : o.domain;
  return (
    <div className="space-y-0.5 text-[11px] text-muted-foreground">
      {!hideProject && proj && (
        <p className="flex items-center gap-1.5">
          <i className="ph-bold ph-stack shrink-0" aria-hidden />
          <span className="min-w-0 truncate">Project: <span className="font-semibold text-foreground">{proj.name}</span></span>
        </p>
      )}
      <p className="flex items-center gap-1.5">
        <i className="ph-bold ph-globe-simple shrink-0" aria-hidden />
        <span className="min-w-0 truncate font-semibold text-foreground">{website}</span>
        {o.urls != null && <span className="shrink-0">· {o.urls.toLocaleString('en-US')} URLs</span>}
      </p>
    </div>
  );
}

/** Folder breadcrumb (parent › child) — its own row at the bottom of the card. */
function FolderPath({ o }: { o: Order }) {
  const path = folderPathForDomain(o.domain);
  if (!path.length) return null;
  const leaf = path[path.length - 1];
  return (
    <div className="mt-2 flex items-center gap-1 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
      <i className="ph-bold ph-folder-simple shrink-0" aria-hidden style={{ color: leaf.color }} />
      <span className="min-w-0 truncate">
        {path.map((f, i) => (
          <span key={f.id} className={i === path.length - 1 ? 'font-semibold' : ''} style={i === path.length - 1 ? { color: leaf.color } : undefined}>
            {i > 0 && <span className="text-muted-foreground/50"> › </span>}
            {f.name}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Progress bar + created-date / percent footer. */
function ProgressRow({ o, done, p, showPct = true, showDate = true }: { o: Order; done: boolean; p: number; showPct?: boolean; showDate?: boolean }) {
  return (
    <>
      <div className="bar mt-2"><i style={{ width: `${p}%` }} /></div>
      {(showDate || showPct) && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          {showDate ? <span className="inline-flex items-center gap-1"><i className="ph-bold ph-calendar-blank" aria-hidden /> {o.date}</span> : <span />}
          {showPct && <b className={done ? 'text-emerald-600' : 'text-primary'}>{p}%</b>}
        </div>
      )}
    </>
  );
}

/** Extra row shown only in Detail density: ETA (staff is shown on every card). */
function DetailRows({ o }: { o: Order }) {
  return (
    <div className="space-y-0.5 text-[11px] text-muted-foreground">
      <p className="flex items-center gap-1.5"><i className="ph-bold ph-timer shrink-0" aria-hidden /> ETA: <span className="font-medium text-foreground">{o.eta}</span></p>
    </div>
  );
}

/**
 * Card content. `template` picks the headline emphasis; `density` picks how much
 * shows: compact (header + title + progress), standard (+ project/website/folder),
 * detail (+ assignee/ETA).
 */
function cardInner(o: Order, template: CardTemplate, density: CardDensity, done: boolean, p: number, reviewing: boolean, planned: boolean) {
  const compact = density === 'compact';
  const detail = density === 'detail';
  // Top row: Done badge (when completed), service type tag, service code (right).
  const topRow = (
    <div className="flex items-center gap-2">
      <DoneBadge done={done} />
      <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70">
        <i className={`ph-bold ${SERVICES[o.service].icon} shrink-0`} aria-hidden />
        <span className="truncate">{SERVICES[o.service].label}</span>
      </span>
      <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground/70">#{o.id}</span>
    </div>
  );

  let headline: ReactNode;
  if (template === 'project') {
    const proj = projectForDomain(o.domain);
    headline = (
      <>
        <h4 className="mt-1.5 truncate text-[15px] font-bold tracking-tight">{proj?.name ?? o.domain}</h4>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.title}</p>
      </>
    );
  } else if (template === 'progress') {
    headline = (
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{o.title}</h4>
        <span className={`display shrink-0 text-2xl font-bold leading-none ${done ? 'text-emerald-600' : 'text-primary'}`}>
          {p}<span className="text-xs">%</span>
        </span>
      </div>
    );
  } else {
    // balanced — service name (title) is the headline.
    headline = <h4 className="mt-1.5 truncate text-sm font-semibold">{o.title}</h4>;
  }

  return (
    <>
      {topRow}
      {headline}
      <StaffTag name={o.owner} role={STAFF_ROLE[o.service]} className="mt-1.5 text-[11px] font-medium text-foreground/80" />
      {!planned && <ManagerTag name={managerFor(o.id)} reviewing={reviewing} className="mt-1 text-[11px] font-medium text-foreground/70" />}
      {!compact && <div className="mt-1.5"><MetaRows o={o} hideProject={template === 'project'} /></div>}
      {detail && <div className="mt-1.5"><DetailRows o={o} /></div>}
      <ProgressRow o={o} done={done} p={p} showPct={template !== 'progress'} showDate={!compact} />
      {!compact && <FolderPath o={o} />}
    </>
  );
}

function OrderCard({ o, template, density = 'standard', preview = false, tint, index = 0, status, onOpen }: { o: Order; template: CardTemplate; density?: CardDensity; preview?: boolean; tint?: string; index?: number; status?: OrderStatus; onOpen?: (id: string) => void }) {
  const eff = status ?? o.status;
  const done = eff === 'completed';
  const p = o.progress ?? (eff === 'completed' ? 100 : eff === 'review' ? 95 : 8);
  const style: { backgroundColor?: string; borderColor?: string; borderLeft?: string; animationDelay?: string } = {};
  if (tint) {
    style.backgroundColor = `${tint}1f`;   // card fill — a touch darker than the column
    style.borderColor = `${tint}40`;       // card border — same hue, a bit darker than the fill
  }
  if (!preview) style.animationDelay = `${Math.min(index, 12) * 40}ms`;   // staggered entrance
  const cls = `kcard block${done ? ' opacity-90' : ''}${preview ? ' pointer-events-none' : ' onav kcard-anim'}`;
  const children = cardInner(o, template, density, done, p, eff === 'review', eff === 'planned');

  if (preview) return <div className={cls} style={style}>{children}</div>;
  return <button type="button" onClick={() => onOpen?.(o.id)} className={`${cls} w-full text-left`} style={style}>{children}</button>;
}

const SAMPLE: Order = ORDERS.find((o) => o.progress != null) ?? ORDERS[0];

// Delivered orders awaiting the customer's approve/send-back decision. Surfaced in the Completed column
// with an "awaiting review" tag + a countdown to auto-approval (auto_approve_stale_deliveries, 7 days).
const AUTO_APPROVE_GRACE_DAYS = 7;
function autoApproveLabel(deliveredAt?: string | null): string | null {
  if (!deliveredAt) return null;
  const left = Math.max(0, Math.ceil((new Date(deliveredAt).getTime() + AUTO_APPROVE_GRACE_DAYS * 86_400_000 - Date.now()) / 86_400_000));
  return left <= 0 ? 'auto-approves today' : `auto-approves in ${left}d`;
}
function AwaitingReviewCard({ o, tint, onOpen }: { o: Order; tint: string; onOpen?: (id: string) => void }) {
  const cd = autoApproveLabel(o.deliveredAt);
  return (
    <button type="button" onClick={() => onOpen?.(o.id)} className="kcard onav kcard-anim block w-full text-left" style={{ backgroundColor: `${tint}1f`, borderColor: `${tint}40` }}>
      <div className="flex items-center gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70">
          <i className={`ph-bold ${SERVICES[o.service].icon} shrink-0`} aria-hidden /><span className="truncate">{SERVICES[o.service].label}</span>
        </span>
        <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground/70">#{o.id}</span>
      </div>
      <h4 className="mt-1.5 truncate text-sm font-semibold">{o.title}</h4>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><i className="ph-bold ph-hourglass-medium" aria-hidden />Awaiting review</span>
        {cd && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"><i className="ph-bold ph-clock-countdown" aria-hidden />{cd}</span>}
      </div>
    </button>
  );
}

export function OrdersBoard({ initialService = 'all', domain, orders, awaitingReview = [] }: { initialService?: ServiceKey | 'all'; domain?: string; orders?: Order[]; awaitingReview?: Order[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { statusOverrides, addedOrders } = useOrdersStore();
  const effStatus = (o: Order): OrderStatus => statusOverrides[o.id] ?? o.status;
  const openOrder = (id: string) => router.push(`${pathname}?order=${id}`, { scroll: false });

  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [svc, setSvc] = useState<ServiceKey | 'all'>(initialService);
  const [proj, setProj] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all'); // list view only
  const [dateRange, setDateRange] = useState<number>(0); // days; 0 = all time. list view only
  const [card, setCard] = useState<CardTemplate>('balanced');
  const [density, setDensity] = useState<CardDensity>('standard');
  const [mobileCol, setMobileCol] = useState<OrderStatus>('progress');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // List-view column manager: show/hide + drag-reorder, remembered across reloads.
  const [colOrder, setColOrder] = useState<ColId[]>(DEFAULT_COLS);
  const [hiddenCols, setHiddenCols] = useState<Set<ColId>>(new Set());
  const [showCols, setShowCols] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const dragIdx = useRef<number | null>(null);
  // Apply a preset: its columns become visible (in order), the rest hidden but still listed.
  const applyPreset = (cols: ColId[]) => {
    const rest = DEFAULT_COLS.filter((c) => !cols.includes(c));
    setColOrder([...cols, ...rest]);
    setHiddenCols(new Set(rest));
    setShowPresets(false);
  };
  const toggleCol = (id: ColId) => setHiddenCols((prev) => {
    const n = new Set(prev);
    if (n.has(id)) { n.delete(id); return n; }
    if (colOrder.filter((c) => !n.has(c)).length <= 1) return prev; // keep at least one column visible
    n.add(id);
    return n;
  });
  const reorderCol = (toIdx: number) => {
    const fromIdx = dragIdx.current;
    if (fromIdx == null || fromIdx === toIdx) return;
    setColOrder((prev) => { const n = [...prev]; const [m] = n.splice(fromIdx, 1); n.splice(toIdx, 0, m); return n; });
    dragIdx.current = null;
  };
  // Keyboard-accessible alternative to dragging: nudge a column up/down one slot.
  const moveCol = (idx: number, dir: -1 | 1) => setColOrder((prev) => {
    const to = idx + dir;
    if (to < 0 || to >= prev.length) return prev;
    const n = [...prev]; [n[idx], n[to]] = [n[to], n[idx]]; return n;
  });
  const visibleCols = colOrder.filter((id) => !hiddenCols.has(id));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const closeModal = () => {
    setModalClosing(true);
    setTimeout(() => { setModalOpen(false); setModalClosing(false); }, 150);
  };

  // Remember the chosen view (Kanban / List), card layout + density across reloads & pages.
  useEffect(() => {
    const savedV = localStorage.getItem(STORAGE_KEY_VIEW);
    if (savedV === 'list' || savedV === 'kanban') setView(savedV);
    const saved = localStorage.getItem(STORAGE_KEY) as CardTemplate | null;
    if (saved && TEMPLATES.some((t) => t.key === saved)) setCard(saved);
    const savedD = localStorage.getItem(STORAGE_KEY_DENSITY) as CardDensity | null;
    if (savedD && DENSITIES.some((d) => d.key === savedD)) setDensity(savedD);
    try {
      const savedC = JSON.parse(localStorage.getItem(STORAGE_KEY_COLS) ?? 'null') as { order?: ColId[]; hidden?: ColId[] } | null;
      if (savedC?.order) {
        // Keep only known ids, then append any columns added since the saved config.
        const known = savedC.order.filter((id) => DEFAULT_COLS.includes(id));
        setColOrder([...known, ...DEFAULT_COLS.filter((id) => !known.includes(id))]);
      }
      if (savedC?.hidden) setHiddenCols(new Set(savedC.hidden.filter((id) => DEFAULT_COLS.includes(id))));
    } catch { /* ignore malformed config */ }
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, card); }, [card]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_DENSITY, density); }, [density]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLS, JSON.stringify({ order: colOrder, hidden: [...hiddenCols] }));
  }, [colOrder, hiddenCols]);

  // Close the modal on Escape.
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Session-placed orders (from the Services flow) sit on top of the base orders. `orders` is the
  // real RLS-scoped read (customer dashboard, inc-3d); falls back to the mock seed where not wired.
  const baseOrders = orders ?? ORDERS;
  const allOrders = useMemo(() => [...addedOrders, ...baseOrders], [addedOrders, baseOrders]);
  const domains = useMemo(() => Array.from(new Set(allOrders.map((o) => o.domain))).sort(), [allOrders]);
  // "Now" for the time filter = the most recent order, so "Last 7 days" is relative to real activity.
  const today = useMemo(() => {
    const ts = allOrders.map((o) => parseUS(o.date)).filter((t): t is number => t != null);
    return ts.length ? Math.max(...ts) : Date.now();
  }, [allOrders]);
  // The status + time filters apply to the List view only (Kanban already groups by status).
  const listFilters = view === 'list';
  const data = useMemo(
    () => allOrders.filter((o) => {
      if (!(svc === 'all' || o.service === svc)) return false;
      if (!(proj === 'all' || o.domain === proj)) return false;
      if (domain && o.domain !== domain) return false;
      if (listFilters && statusFilter !== 'all' && effStatus(o) !== statusFilter) return false;
      if (listFilters && dateRange > 0) {
        const t = parseUS(o.date);
        if (t == null || today - t > dateRange * 86_400_000) return false;
      }
      return true;
    }),
    [allOrders, svc, proj, domain, listFilters, statusFilter, dateRange, today, statusOverrides], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filters: (ServiceKey | 'all')[] = ['all', ...(Object.keys(SERVICES) as ServiceKey[])];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="display text-lg font-semibold tracking-tight">Service order progress</h2>
          <p className="text-xs text-muted-foreground">Filter by service · click an order to open the project · switch Kanban / List</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {view === 'kanban' && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent"
            >
              <i className="ph-bold ph-layout text-muted-foreground" aria-hidden /> Card design
            </button>
          )}
          {view === 'list' && (
            <div className="relative">
              <button
                onClick={() => setShowPresets((v) => !v)}
                aria-expanded={showPresets}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent"
              >
                <i className="ph-bold ph-sliders-horizontal text-muted-foreground" aria-hidden /> Presets
              </button>
              {showPresets && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPresets(false)} />
                  <div className="absolute right-0 z-50 mt-1.5 w-60 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                    <p className="px-1.5 pb-1 pt-0.5 text-[11px] font-semibold text-muted-foreground">Table presets</p>
                    {PRESETS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => applyPreset(p.cols)}
                        className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition hover:bg-muted"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><i className={`ph-bold ${p.icon}`} aria-hidden /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{p.label}</span>
                          <span className="block text-[11px] text-muted-foreground">{p.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {view === 'list' && (
            <div className="relative">
              <button
                onClick={() => setShowCols((v) => !v)}
                aria-expanded={showCols}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent"
              >
                <i className="ph-bold ph-columns text-muted-foreground" aria-hidden /> Columns
              </button>
              {showCols && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCols(false)} />
                  <div className="absolute right-0 z-50 mt-1.5 w-60 rounded-xl border border-border bg-card p-2 shadow-xl">
                    <div className="flex items-center justify-between px-1.5 pb-1.5">
                      <p className="text-[11px] font-semibold text-muted-foreground">Show &amp; drag to reorder</p>
                      <button
                        onClick={() => { setColOrder(DEFAULT_COLS); setHiddenCols(new Set()); }}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                    {colOrder.map((id, i) => (
                      <div
                        key={id}
                        draggable
                        onDragStart={() => { dragIdx.current = i; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => reorderCol(i)}
                        className="group flex cursor-grab items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted active:cursor-grabbing"
                      >
                        <i className="ph-bold ph-dots-six-vertical text-muted-foreground" aria-hidden />
                        <input type="checkbox" checked={!hiddenCols.has(id)} disabled={visibleCols.length === 1 && !hiddenCols.has(id)} onChange={() => toggleCol(id)} className="h-3.5 w-3.5 accent-primary disabled:opacity-40" />
                        <span className="flex-1">{COL_LABEL[id]}</span>
                        <span className="flex items-center gap-0.5">
                          <button type="button" aria-label={`Move ${COL_LABEL[id]} up`} disabled={i === 0} onClick={() => moveCol(i, -1)} className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent">
                            <i className="ph-bold ph-caret-up text-[11px]" aria-hidden />
                          </button>
                          <button type="button" aria-label={`Move ${COL_LABEL[id]} down`} disabled={i === colOrder.length - 1} onClick={() => moveCol(i, 1)} className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent">
                            <i className="ph-bold ph-caret-down text-[11px]" aria-hidden />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {!domain && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold">
              <i className="ph-bold ph-globe-hemisphere-west text-muted-foreground" aria-hidden />
              <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Filter by project" className="cursor-pointer bg-transparent pr-1 outline-none">
                <option value="all">All projects</option>
                {domains.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div className="view-toggle flex items-center gap-1 rounded-lg border border-border bg-muted p-1 text-xs font-medium">
            <button onClick={() => { setView('kanban'); localStorage.setItem(STORAGE_KEY_VIEW, 'kanban'); }} className={`rounded-md px-2.5 py-1.5 ${view === 'kanban' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><i className="ph-bold ph-kanban" aria-hidden /> Kanban</button>
            <button onClick={() => { setView('list'); localStorage.setItem(STORAGE_KEY_VIEW, 'list'); }} className={`rounded-md px-2.5 py-1.5 ${view === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><i className="ph-bold ph-list" aria-hidden /> List</button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="scrollbar-thin flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
          {filters.map((k) => (
            <button
              key={k}
              onClick={() => setSvc(k)}
              className={`filter-btn inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                svc === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent'
              }`}
            >
              <i className={`ph-bold ${k === 'all' ? 'ph-squares-four' : SERVICES[k].icon}`} aria-hidden />
              {k === 'all' ? 'All' : SERVICES[k].label}
            </button>
          ))}
        </div>
        {view === 'list' && (
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold">
              <i className="ph-bold ph-funnel text-muted-foreground" aria-hidden />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')} aria-label="Filter by status" className="cursor-pointer bg-transparent pr-1 outline-none">
                <option value="all">All statuses</option>
                {(Object.keys(STATUSES) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUSES[s].label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold">
              <i className="ph-bold ph-calendar-blank text-muted-foreground" aria-hidden />
              <select value={dateRange} onChange={(e) => setDateRange(Number(e.target.value))} aria-label="Filter by time" className="cursor-pointer bg-transparent pr-1 outline-none">
                {DATE_RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {view === 'kanban' ? (
        <div key={`${svc}-${proj}-${card}-${density}-${mobileCol}`} className="mt-4 grid grid-cols-1 items-start gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {COLS.map((st) => {
              const items = data.filter((o) => effStatus(o) === st);
              // Delivered-awaiting-review orders sit at the top of the Completed column (real data).
              const review = st === 'completed' ? awaitingReview : [];
              const total = items.length + review.length;
              const c = STATUSES[st].color;
              return (
                <div key={st} className={`rounded-xl p-2 sm:block ${st === mobileCol ? '' : 'hidden'}`} style={{ backgroundColor: `${c}0d` }}>
                  <div className="flex items-center justify-between px-0.5 pb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: `${c}24`, color: c }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} /> {STATUSES[st].label}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: `${c}1a`, color: c }}>{total}</span>
                  </div>
                  <div className="space-y-2">
                    {review.map((o) => <AwaitingReviewCard key={o.id} o={o} tint={c} onOpen={openOrder} />)}
                    {items.length
                      ? items.map((o, i) => <OrderCard key={o.id} o={o} template={card} density={density} tint={c} index={i} status={st} onOpen={openOrder} />)
                      : review.length === 0 && <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground" style={{ borderColor: `${c}33` }}>Empty</p>}
                  </div>
                </div>
              );
            })}
          </div>
      ) : (
        <>
        {/* mobile: card list — fields follow the same show/hide column choices */}
        <div className="mt-4 space-y-2 sm:hidden">
          {data.map((o) => {
            const est = effStatus(o);
            const sc = STATUSES[est];
            const pp = pct(o);
            const proj = projectForDomain(o.domain);
            const folderLeaf = folderPathForDomain(o.domain).at(-1);
            const show = (id: ColId) => !hiddenCols.has(id);
            return (
              <button key={o.id} onClick={() => openOrder(o.id)} className="kcard onav block w-full text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <DoneBadge done={est === 'completed'} />
                  {show('service') && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70"><i className={`ph-bold ${SERVICES[o.service].icon}`} aria-hidden /> {SERVICES[o.service].label}</span>}
                  {show('code') && <span className="font-mono text-[11px] text-muted-foreground">#{o.id}</span>}
                  {show('status') && <span className="pill ml-auto" style={{ background: `${sc.color}1f`, color: sc.color }}>● {sc.label}</span>}
                </div>
                <div className="mt-2 flex items-start justify-between gap-3">
                  {show('service') && (
                    <div className="min-w-0">
                      <h4 className="font-semibold leading-tight">{o.title}</h4>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{o.sub}</p>
                    </div>
                  )}
                  {show('eta') && (
                    <div className="ml-auto shrink-0 text-right text-[12px]">
                      <p className="font-semibold">${o.cost.toLocaleString('en-US')}</p>
                      <p className={est === 'completed' ? 'text-emerald-600' : 'text-muted-foreground'}>{o.eta}</p>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  {show('project') && <span className="inline-flex items-center gap-1.5"><i className="ph-bold ph-stack" aria-hidden /> {proj?.name ?? o.domain}</span>}
                  {show('domain') && <span className="inline-flex items-center gap-1.5"><i className="ph-bold ph-globe-simple" aria-hidden /> {o.multiWeb ? 'Multi-site' : o.domain}</span>}
                  {show('folder') && folderLeaf && <span className="inline-flex items-center gap-1.5" style={{ color: folderLeaf.color }}><i className="ph-bold ph-folder" aria-hidden /> {folderLeaf.name}</span>}
                  {show('staff') && <span className="inline-flex items-center gap-1.5"><i className="ph-bold ph-user" aria-hidden /> {o.owner}</span>}
                  {show('code') && <span className="inline-flex items-center gap-1.5"><i className="ph-bold ph-calendar-blank" aria-hidden /> {o.date}</span>}
                </div>
                {show('progress') && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="bar flex-1"><i style={{ width: `${pp}%` }} /></span>
                    <b className="text-[12px] font-semibold" style={{ color: sc.color }}>{pp}%</b>
                  </div>
                )}
              </button>
            );
          })}
          {data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No orders match the current filters.</p>}
        </div>

        {/* desktop: original table */}
        <div className="mt-4 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {visibleCols.map((id) => (
                  <th key={id} className={`px-3 py-2.5 ${COL_ALIGN[id] === 'center' ? 'text-center' : COL_ALIGN[id] === 'right' ? 'text-right' : ''}`}>{COL_LABEL[id]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((o, i) => {
                const est = effStatus(o);
                return (
                <tr key={o.id} onClick={() => openOrder(o.id)} className="cursor-pointer transition hover:bg-accent/40">
                  {visibleCols.map((id) => (
                    <td key={id} className={`${LIST_TD[id]}${id === 'eta' && est === 'completed' ? ' text-emerald-600' : ''}`}>{listCell(id, o, i, est)}</td>
                  ))}
                </tr>
                );
              })}
            </tbody>
          </table>
          {data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No orders match the current filters.</p>}
        </div>
        </>
      )}

      {/* mobile: column switcher pinned to the bottom of the viewport */}
      {view === 'kanban' && mounted && createPortal(
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-border bg-card/95 px-3 py-2 backdrop-blur sm:hidden">
          {COLS.map((st) => {
            const c = STATUSES[st].color;
            const n = data.filter((o) => effStatus(o) === st).length;
            const active = st === mobileCol;
            return (
              <button
                key={st}
                onClick={() => setMobileCol(st)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold transition ${active ? '' : 'text-muted-foreground'}`}
                style={active ? { backgroundColor: `${c}1f`, color: c } : undefined}
              >
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} /> {n}</span>
                <span className="max-w-full truncate">{STATUSES[st].label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {/* Card design picker */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Card design">
          <button aria-hidden tabIndex={-1} onClick={closeModal} className={`${modalClosing ? 'order-backdrop-out' : 'order-backdrop'} absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm`} />
          <div className={`${modalClosing ? 'modal-out' : 'modal-in'} scrollbar-thin relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="display text-lg font-semibold tracking-tight">Card design</h3>
                <p className="text-xs text-muted-foreground">Pick how much each card shows (density) and which field it emphasizes (layout).</p>
              </div>
              <button onClick={closeModal} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent">
                <i className="ph-bold ph-x" aria-hidden />
              </button>
            </div>

            {/* density */}
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Density</p>
              <div className="inline-flex rounded-lg border border-border bg-muted p-1 text-xs font-medium">
                {DENSITIES.map((d) => (
                  <button key={d.key} onClick={() => setDensity(d.key)} className={`rounded-md px-3.5 py-1.5 transition ${density === d.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{d.label}</button>
                ))}
              </div>
            </div>

            {/* layout */}
            <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Layout</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATES.map((t) => {
                const active = card === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setCard(t.key)}
                    aria-pressed={active}
                    className={`rounded-xl border p-3 text-left transition ${active ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {t.label}
                        {active && <i className="ph-fill ph-check-circle text-primary" aria-hidden />}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                    <div className="mt-2.5 rounded-lg bg-muted/40 p-2.5">
                      <OrderCard o={SAMPLE} template={t.key} density={density} preview />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={closeModal} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
