'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import {
  ORDERS, SERVICES, STATUSES, PRIORITIES, projectForDomain, folderPathForDomain,
  type Order, type OrderStatus, type ServiceKey,
} from '@/data/mock';
import { useOrdersStore } from './OrdersStore';

const COLS: OrderStatus[] = ['planned', 'progress', 'review', 'completed'];
const PRIO_HEX: Record<Order['priority'], string> = {
  high: '#f43f5e', med: '#f59e0b', low: '#94a3b8',
};

/** Card layouts: same info, different emphasis. */
type CardTemplate = 'balanced' | 'priority' | 'project' | 'progress';

const TEMPLATES: { key: CardTemplate; label: string; desc: string }[] = [
  { key: 'balanced', label: 'Balanced',       desc: 'Even hierarchy (default)' },
  { key: 'priority', label: 'Priority first', desc: 'Urgency rail + priority on top' },
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

function pct(o: Order) {
  return o.progress ?? (o.status === 'completed' ? 100 : o.status === 'review' ? 95 : 8);
}

/** Priority chip (or a Done badge) — sits top-left on every card. */
function PriorityBadge({ o, done }: { o: Order; done: boolean }) {
  if (done) return <span className="pill pill-good">Done</span>;
  return <span className={`prio prio-${o.priority}`}>{PRIORITIES[o.priority]}</span>;
}

/** Compact meta block: project + website·URLs on two lines. */
function MetaRows({ o, hideProject = false }: { o: Order; hideProject?: boolean }) {
  const proj = projectForDomain(o.domain);
  const website = o.multiWeb ? 'Multi-site' : o.domain;
  return (
    <div className="space-y-0.5 text-[11px] text-muted-foreground">
      {!hideProject && proj && (
        <p className="flex items-center gap-1.5">
          <i className="ph-bold ph-stack shrink-0" />
          <span className="min-w-0 truncate">Project: <span className="font-semibold text-foreground">{proj.name}</span></span>
        </p>
      )}
      <p className="flex items-center gap-1.5">
        <i className="ph-bold ph-globe-simple shrink-0" />
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
      <i className="ph-bold ph-folder-simple shrink-0" style={{ color: leaf.color }} />
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
          {showDate ? <span className="inline-flex items-center gap-1"><i className="ph-bold ph-calendar-blank" /> {o.date}</span> : <span />}
          {showPct && <b className={done ? 'text-emerald-600' : 'text-primary'}>{p}%</b>}
        </div>
      )}
    </>
  );
}

/** Extra rows shown only in Detail density: assignee + ETA. */
function DetailRows({ o }: { o: Order }) {
  return (
    <div className="space-y-0.5 text-[11px] text-muted-foreground">
      <p className="flex items-center gap-1.5"><i className="ph-bold ph-user shrink-0" /><span className="min-w-0 truncate">{o.owner}</span></p>
      <p className="flex items-center gap-1.5"><i className="ph-bold ph-timer shrink-0" /> ETA: <span className="font-medium text-foreground">{o.eta}</span></p>
    </div>
  );
}

/**
 * Card content. `template` picks the headline emphasis; `density` picks how much
 * shows: compact (header + title + progress), standard (+ project/website/folder),
 * detail (+ assignee/ETA).
 */
function cardInner(o: Order, template: CardTemplate, density: CardDensity, done: boolean, p: number) {
  const compact = density === 'compact';
  const detail = density === 'detail';
  // Top row: priority (left), service type tag, service code (right).
  const topRow = (
    <div className="flex items-center gap-2">
      <PriorityBadge o={o} done={done} />
      <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70">
        <i className={`ph-bold ${SERVICES[o.service].icon} shrink-0`} />
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
    // balanced & priority — service name (title) is the headline.
    headline = <h4 className="mt-1.5 truncate text-sm font-semibold">{o.title}</h4>;
  }

  return (
    <>
      {topRow}
      {headline}
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
  if (template === 'priority') style.borderLeft = `3px solid ${done ? '#10b981' : PRIO_HEX[o.priority]}`;
  if (!preview) style.animationDelay = `${Math.min(index, 12) * 40}ms`;   // staggered entrance
  const cls = `kcard block${done ? ' opacity-90' : ''}${preview ? ' pointer-events-none' : ' onav kcard-anim'}`;
  const children = cardInner(o, template, density, done, p);

  if (preview) return <div className={cls} style={style}>{children}</div>;
  return <button type="button" onClick={() => onOpen?.(o.id)} className={`${cls} w-full text-left`} style={style}>{children}</button>;
}

const SAMPLE: Order = ORDERS.find((o) => o.progress != null) ?? ORDERS[0];

export function OrdersBoard({ initialService = 'all', domain }: { initialService?: ServiceKey | 'all'; domain?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { statusOverrides, addedOrders } = useOrdersStore();
  const effStatus = (o: Order): OrderStatus => statusOverrides[o.id] ?? o.status;
  const openOrder = (id: string) => router.push(`${pathname}?order=${id}`, { scroll: false });

  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [svc, setSvc] = useState<ServiceKey | 'all'>(initialService);
  const [proj, setProj] = useState<string>('all');
  const [card, setCard] = useState<CardTemplate>('balanced');
  const [density, setDensity] = useState<CardDensity>('standard');
  const [mobileCol, setMobileCol] = useState<OrderStatus>('progress');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const closeModal = () => {
    setModalClosing(true);
    setTimeout(() => { setModalOpen(false); setModalClosing(false); }, 150);
  };

  // Remember the chosen card layout + density across reloads.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as CardTemplate | null;
    if (saved && TEMPLATES.some((t) => t.key === saved)) setCard(saved);
    const savedD = localStorage.getItem(STORAGE_KEY_DENSITY) as CardDensity | null;
    if (savedD && DENSITIES.some((d) => d.key === savedD)) setDensity(savedD);
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, card); }, [card]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_DENSITY, density); }, [density]);

  // Close the modal on Escape.
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Session-placed orders (from the Services flow) sit on top of the seed data.
  const allOrders = useMemo(() => [...addedOrders, ...ORDERS], [addedOrders]);
  const domains = useMemo(() => Array.from(new Set(allOrders.map((o) => o.domain))).sort(), [allOrders]);
  const data = useMemo(
    () => allOrders.filter((o) =>
      (svc === 'all' || o.service === svc) &&
      (proj === 'all' || o.domain === proj) &&
      (!domain || o.domain === domain)
    ),
    [allOrders, svc, proj, domain]
  );

  const filters: (ServiceKey | 'all')[] = ['all', ...(Object.keys(SERVICES) as ServiceKey[])];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="display text-lg font-semibold tracking-tight">Service order progress</h3>
          <p className="text-xs text-muted-foreground">Filter by service · click an order to open the project · switch Kanban / List</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {view === 'kanban' && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent"
            >
              <i className="ph-bold ph-layout text-muted-foreground" /> Card design
            </button>
          )}
          {!domain && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold">
              <i className="ph-bold ph-globe-hemisphere-west text-muted-foreground" />
              <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Filter by project" className="cursor-pointer bg-transparent pr-1 outline-none">
                <option value="all">All projects</option>
                {domains.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1 text-xs font-medium">
            <button onClick={() => setView('kanban')} className={`rounded-md px-2.5 py-1.5 ${view === 'kanban' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><i className="ph-bold ph-kanban" /> Kanban</button>
            <button onClick={() => setView('list')} className={`rounded-md px-2.5 py-1.5 ${view === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><i className="ph-bold ph-list" /> List</button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {filters.map((k) => (
          <button
            key={k}
            onClick={() => setSvc(k)}
            className={`filter-btn inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              svc === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent'
            }`}
          >
            <i className={`ph-bold ${k === 'all' ? 'ph-squares-four' : SERVICES[k].icon}`} />
            {k === 'all' ? 'All' : SERVICES[k].label}
          </button>
        ))}
      </div>

      {view === 'kanban' ? (
        <div key={`${svc}-${proj}-${card}-${density}-${mobileCol}`} className="mt-4 grid grid-cols-1 items-start gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {COLS.map((st) => {
              const items = data.filter((o) => effStatus(o) === st);
              const c = STATUSES[st].color;
              return (
                <div key={st} className={`rounded-xl p-2 sm:block ${st === mobileCol ? '' : 'hidden'}`} style={{ backgroundColor: `${c}0d` }}>
                  <div className="flex items-center justify-between px-0.5 pb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: `${c}24`, color: c }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} /> {STATUSES[st].label}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: `${c}1a`, color: c }}>{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.length
                      ? items.map((o, i) => <OrderCard key={o.id} o={o} template={card} density={density} tint={c} index={i} status={st} onOpen={openOrder} />)
                      : <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground" style={{ borderColor: `${c}33` }}>Empty</p>}
                  </div>
                </div>
              );
            })}
          </div>
      ) : (
        <>
        {/* mobile: card list */}
        <div className="mt-4 space-y-2 sm:hidden">
          {data.map((o) => {
            const est = effStatus(o);
            const sc = STATUSES[est];
            const pp = pct(o);
            const proj = projectForDomain(o.domain);
            return (
              <button key={o.id} onClick={() => openOrder(o.id)} className="kcard onav block w-full text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge o={o} done={est === 'completed'} />
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70"><i className={`ph-bold ${SERVICES[o.service].icon}`} /> {SERVICES[o.service].label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">#{o.id}</span>
                  <span className="pill ml-auto" style={{ background: `${sc.color}1f`, color: sc.color }}>● {sc.label}</span>
                </div>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold leading-tight">{o.title}</h4>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{o.sub}</p>
                  </div>
                  <div className="shrink-0 text-right text-[12px]">
                    <p className="font-semibold">${o.cost.toLocaleString('en-US')}</p>
                    <p className={est === 'completed' ? 'text-emerald-600' : 'text-muted-foreground'}>{o.eta}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><i className="ph-bold ph-stack" /> {proj?.name ?? o.domain}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="ph-bold ph-globe-simple" /> {o.multiWeb ? 'Multi-site' : o.domain}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="ph-bold ph-user" /> {o.owner}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="ph-bold ph-calendar-blank" /> {o.date}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="bar flex-1"><i style={{ width: `${pp}%` }} /></span>
                  <b className="text-[12px] font-semibold" style={{ color: sc.color }}>{pp}%</b>
                </div>
              </button>
            );
          })}
          {data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No orders for this service.</p>}
        </div>

        {/* desktop: original table */}
        <div className="mt-4 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-3 text-center">No.</th>
                <th className="px-3 py-2.5">Code</th>
                <th className="px-3 py-2.5">Order / Service</th>
                <th className="px-3 py-2.5">Domain</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Progress</th>
                <th className="px-3 py-2.5">Priority</th>
                <th className="py-2.5 pl-3 text-right">ETA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((o, i) => {
                const est = effStatus(o);
                return (
                <tr key={o.id} onClick={() => openOrder(o.id)} className="cursor-pointer transition hover:bg-accent/40">
                  <td className="py-3 pr-3 text-center text-xs font-semibold text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-3"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/70">#{o.id}</span></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><i className={`ph-bold ${SERVICES[o.service].icon}`} /></span><div><p className="font-semibold leading-tight">{o.title}</p><p className="text-[11px] text-muted-foreground">{o.sub}</p></div></div></td>
                  <td className="px-3 py-3 text-muted-foreground">{o.domain}</td>
                  <td className="px-3 py-3"><span className="pill" style={{ background: `${STATUSES[est].color}1f`, color: STATUSES[est].color }}>● {STATUSES[est].label}</span></td>
                  <td className="px-3 py-3"><span className="bar inline-block w-24 align-middle"><i style={{ width: `${pct(o)}%` }} /></span></td>
                  <td className="px-3 py-3"><span className={`prio prio-${o.priority}`}>{PRIORITIES[o.priority]}</span></td>
                  <td className={`py-3 pl-3 text-right font-semibold${est === 'completed' ? ' text-emerald-600' : ''}`}>{o.eta}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No orders for this service.</p>}
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
          <button aria-hidden tabIndex={-1} onClick={closeModal} className={`${modalClosing ? 'order-backdrop-out' : 'order-backdrop'} absolute inset-0 cursor-default bg-foreground/40 backdrop-blur-sm`} />
          <div className={`${modalClosing ? 'modal-out' : 'modal-in'} scrollbar-thin relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="display text-lg font-semibold tracking-tight">Card design</h3>
                <p className="text-xs text-muted-foreground">Pick how much each card shows (density) and which field it emphasizes (layout).</p>
              </div>
              <button onClick={closeModal} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent">
                <i className="ph-bold ph-x" />
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
                        {active && <i className="ph-fill ph-check-circle text-primary" />}
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
