'use client';

import { useState, useMemo, useRef, Fragment, type ReactNode } from 'react';
import { SlideOver } from '@/components/shared/SlideOver';

// --- Exported types (consumed by page.tsx) ---
export interface PkgRow {
  id: string; name: string; price: number; priceLabel: string;
  sla: string; popular: boolean; features: string[];
  groupId: string | null; groupTitle: string | null;
}
export interface GroupRow {
  id: string; title: string; subtitle: string | null; icon: string | null;
  packages: PkgRow[];
}
export interface TierRow {
  label: string; rate: number; min: number; sub: string | null;
}
export interface SvcRow {
  key: string; name: string; tagline: string; icon: string; orderCode: string;
  packageCount: number; priceMin: number; priceMax: number; priceLabel: string;
  hasBulk: boolean; hasUsage: boolean; hasGroups: boolean;
  addons: string[];
  packages: PkgRow[];
  groups: GroupRow[];
  usageTiers: TierRow[];
}
interface Props {
  rows: SvcRow[];
  totalPackages: number;
  priceMin: number;
  priceMax: number;
}

// --- Internal form types ---
interface DraftPkg {
  id: string; name: string; price: string; priceLabel: string;
  sla: string; popular: boolean; features: string[];
}
interface DraftSvc {
  key: string; name: string; icon: string; tagline: string; orderCode: string;
}
interface PkgPanelCtx {
  svcKey: string; groupId: string | null; groupTitle: string | null; isNew: boolean;
}

// --- Constants ---
const ADDON_LABEL: Record<string, string> = {
  audit: 'Audit', backlink: 'Backlinks', backlinks: 'Backlinks',
  content: 'Content', indexer: 'Indexer', optimize: 'Optimization',
  optimization: 'Optimization', keyword: 'Keywords', design: 'Design',
};
const ICON_OPTIONS = [
  'ph-stethoscope', 'ph-share-network', 'ph-pen-nib', 'ph-magnifying-glass',
  'ph-gauge', 'ph-tree-structure', 'ph-palette', 'ph-chart-bar',
  'ph-lightning', 'ph-cube', 'ph-rocket-launch', 'ph-link-simple',
  'ph-shield-check', 'ph-code', 'ph-star', 'ph-trophy',
];
const INPUT = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary';
const EMPTY_SVC: DraftSvc = { key: '', name: '', icon: 'ph-cube', tagline: '', orderCode: '' };

// --- Helpers ---
function emptyPkg(): DraftPkg {
  return { id: '', name: '', price: '0', priceLabel: '', sla: '', popular: false, features: [''] };
}
function pkgToForm(p: PkgRow): DraftPkg {
  const isDerived = /^\$\d+(\.\d+)?$/.test(p.priceLabel);
  return {
    id: p.id, name: p.name, price: String(p.price),
    priceLabel: isDerived ? '' : p.priceLabel,
    sla: p.sla, popular: p.popular,
    features: p.features.length ? [...p.features] : [''],
  };
}
function svcToForm(s: SvcRow): DraftSvc {
  return { key: s.key, name: s.name, icon: s.icon, tagline: s.tagline, orderCode: s.orderCode };
}
function recalcSvc(svc: SvcRow): SvcRow {
  const paid = svc.packages.map(p => p.price).filter(p => p > 0);
  const priceMin = paid.length ? Math.min(...paid) : 0;
  const priceMax = paid.length ? Math.max(...paid) : 0;
  let priceLabel: string;
  if (svc.hasUsage) priceLabel = svc.priceLabel;
  else if (paid.length === 0) priceLabel = svc.packages.length ? 'Custom' : '—';
  else if (priceMin === priceMax) priceLabel = `$${priceMin}`;
  else priceLabel = `$${priceMin}–$${priceMax}`;
  return { ...svc, packageCount: svc.packages.length, priceMin, priceMax, priceLabel };
}

// ─── Per-package performance stats ──────────────────────────────────────────────
// Deterministic, seeded from the package id so numbers stay stable across renders
// and apply to packages added live in this session. Scaled by the selected time
// window. (Mock layer — swap for real aggregates over the orders table when the
// DB lands.)
export type RangeKey = '7D' | '30D' | '3M' | '6M' | '12M' | 'YTD';
interface RangeDef { key: RangeKey; label: string; days: number; }

function ytdDays(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
}
export const RANGES: RangeDef[] = [
  { key: '7D',  label: '7D',  days: 7 },
  { key: '30D', label: '30D', days: 30 },
  { key: '3M',  label: '3M',  days: 90 },
  { key: '6M',  label: '6M',  days: 180 },
  { key: '12M', label: '12M', days: 365 },
  { key: 'YTD', label: 'YTD', days: ytdDays() },
];
const rangeDays = (r: RangeKey): number => RANGES.find(x => x.key === r)?.days ?? 30;

export interface PkgStats { orders: number; customers: number; revenue: number; }

function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pkgStats(p: PkgRow, range: RangeKey): PkgStats {
  const seed   = seedFrom(p.id || p.name);
  const annual = 24 + (seed % 240);                          // baseline orders / year
  const days   = rangeDays(range);
  const jitter = 0.85 + ((seed >> (days % 13)) % 31) / 100;  // 0.85–1.15, organic per-range wobble
  const orders = Math.max(0, Math.round((annual * days / 365) * jitter));
  const repeat = 0.55 + ((seed >> 5) % 30) / 100;            // 55–85% unique buyers
  const customers = orders === 0 ? 0 : Math.max(1, Math.min(orders, Math.round(orders * repeat)));
  const unit   = p.price > 0 ? p.price : 120 + ((seed >> 9) % 160); // nominal value for quote/custom
  return { orders, customers, revenue: orders * unit };
}
function svcStats(pkgs: PkgRow[], range: RangeKey): PkgStats {
  return pkgs.reduce<PkgStats>((acc, p) => {
    const s = pkgStats(p, range);
    return { orders: acc.orders + s.orders, customers: acc.customers + s.customers, revenue: acc.revenue + s.revenue };
  }, { orders: 0, customers: 0, revenue: 0 });
}
// Lifetime value — all-time revenue a package has generated. Independent of the
// selected window, so it stays put as you switch ranges.
function pkgLtv(p: PkgRow): number {
  const seed   = seedFrom(p.id || p.name);
  const annual = 24 + (seed % 240);                       // same baseline as pkgStats
  const years  = 1.5 + ((seed >> 7) % 25) / 10;           // 1.5–4.0 years of history
  const unit   = p.price > 0 ? p.price : 120 + ((seed >> 9) % 160);
  return Math.round(annual * years) * unit;
}
function svcLtv(pkgs: PkgRow[]): number {
  return pkgs.reduce((sum, p) => sum + pkgLtv(p), 0);
}
function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `$${n}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CatalogClient({ rows, totalPackages, priceMin, priceMax }: Props) {
  const [draft, setDraft]           = useState<SvcRow[]>(rows);
  const [dirty, setDirty]           = useState(false);
  const [newKeys, setNewKeys]       = useState<Set<string>>(new Set());
  const [editedKeys, setEditedKeys] = useState<Set<string>>(new Set());

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch]     = useState('');
  const [range, setRange]       = useState<RangeKey>('30D');
  const [featOpen, setFeatOpen] = useState<string | null>(null);
  const [toast, setToast]       = useState<string | null>(null);
  const toastTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);

  // pkg panel
  const [pkgPanel, setPkgPanel] = useState<PkgPanelCtx | null>(null);
  const [draftPkg, setDraftPkg] = useState<DraftPkg>(emptyPkg());

  // add service panel
  const [addSvcOpen, setAddSvcOpen] = useState(false);
  const [addSvcDraft, setAddSvcDraft] = useState<DraftSvc>(EMPTY_SVC);

  // edit service panel
  const [editSvcKey, setEditSvcKey]   = useState<string | null>(null);
  const [editSvcDraft, setEditSvcDraft] = useState<DraftSvc>(EMPTY_SVC);

  // delete confirms
  const [confirmDelPkg, setConfirmDelPkg] = useState<{ svcKey: string; pkgId: string } | null>(null);
  const [confirmDelSvc, setConfirmDelSvc] = useState<string | null>(null);

  // ── utils ──
  const notify = (m: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  const mark   = (key: string) => { setDirty(true); setEditedKeys(s => new Set(s).add(key)); };
  const toggle = (key: string) => setExpanded(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── computed stats ──
  const draftTotalPkgs = draft.reduce((n, r) => n + r.packageCount, 0);
  const orderableCount = draft.filter(r => r.packageCount > 0 || r.hasUsage).length;
  const draftPrices    = draft.flatMap(r => r.packages.map(p => p.price)).filter(p => p > 0);
  const draftMin       = draftPrices.length ? Math.min(...draftPrices) : priceMin;
  const draftMax       = draftPrices.length ? Math.max(...draftPrices) : priceMax;

  const filtered = useMemo(() => {
    if (!search.trim()) return draft;
    const q = search.toLowerCase();
    return draft.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.tagline.toLowerCase().includes(q) ||
      r.packages.some(p => p.name.toLowerCase().includes(q))
    );
  }, [draft, search]);

  // ── pkg actions ──
  const openEditPkg = (svcKey: string, pkg: PkgRow) => {
    setDraftPkg(pkgToForm(pkg));
    setPkgPanel({ svcKey, groupId: pkg.groupId, groupTitle: pkg.groupTitle, isNew: false });
  };
  const openAddPkg = (svcKey: string, groupId: string | null, groupTitle: string | null) => {
    setDraftPkg(emptyPkg());
    setPkgPanel({ svcKey, groupId, groupTitle, isNew: true });
  };

  const savePkg = () => {
    if (!pkgPanel) return;
    const { svcKey, groupId, groupTitle, isNew } = pkgPanel;
    const price = Math.max(0, parseFloat(draftPkg.price) || 0);
    const id    = isNew ? `pkg-${Date.now()}` : draftPkg.id;
    const label = draftPkg.priceLabel.trim() || (price > 0 ? `$${price}` : 'Custom');
    const pkg: PkgRow = {
      id, name: draftPkg.name.trim(), price, priceLabel: label,
      sla: draftPkg.sla.trim(), popular: draftPkg.popular,
      features: draftPkg.features.filter(f => f.trim()),
      groupId, groupTitle,
    };
    setDraft(prev => prev.map(svc => {
      if (svc.key !== svcKey) return svc;
      const newPkgs   = isNew ? [...svc.packages, pkg]   : svc.packages.map(p => (p.id === id ? pkg : p));
      const newGroups = isNew
        ? svc.groups.map(g => g.id === groupId ? { ...g, packages: [...g.packages, pkg] } : g)
        : svc.groups.map(g => ({ ...g, packages: g.packages.map(p => (p.id === id ? pkg : p)) }));
      return recalcSvc({ ...svc, packages: newPkgs, groups: newGroups });
    }));
    mark(svcKey);
    setPkgPanel(null);
    notify(isNew ? `"${pkg.name}" added` : `"${pkg.name}" updated`);
  };

  const deletePkg = (svcKey: string, pkgId: string) => {
    setDraft(prev => prev.map(svc => {
      if (svc.key !== svcKey) return svc;
      const newPkgs   = svc.packages.filter(p => p.id !== pkgId);
      const newGroups = svc.groups.map(g => ({ ...g, packages: g.packages.filter(p => p.id !== pkgId) }));
      return recalcSvc({ ...svc, packages: newPkgs, groups: newGroups });
    }));
    mark(svcKey);
    setConfirmDelPkg(null);
    notify('Package deleted');
  };

  // ── service actions ──
  const saveNewSvc = () => {
    const key = addSvcDraft.key.trim().toLowerCase().replace(/\s+/g, '-');
    if (!key || !addSvcDraft.name.trim()) return;
    if (draft.some(r => r.key === key)) { notify('Service ID already exists'); return; }
    const newSvc: SvcRow = {
      key, name: addSvcDraft.name.trim(), tagline: addSvcDraft.tagline.trim(),
      icon: addSvcDraft.icon, orderCode: addSvcDraft.orderCode.trim().toUpperCase(),
      packageCount: 0, priceMin: 0, priceMax: 0, priceLabel: '—',
      hasBulk: false, hasUsage: false, hasGroups: false,
      addons: [], packages: [], groups: [], usageTiers: [],
    };
    setDraft(prev => [...prev, newSvc]);
    setNewKeys(s => new Set(s).add(key));
    setDirty(true);
    setExpanded(s => new Set(s).add(key));
    setAddSvcOpen(false);
    setAddSvcDraft(EMPTY_SVC);
    notify(`Service "${newSvc.name}" created — add packages below`);
  };

  const openEditSvc = (svc: SvcRow) => {
    setEditSvcDraft(svcToForm(svc));
    setEditSvcKey(svc.key);
  };

  const saveEditSvc = () => {
    if (!editSvcKey) return;
    const key = editSvcKey;
    setDraft(prev => prev.map(svc => svc.key !== key ? svc : {
      ...svc,
      name: editSvcDraft.name.trim(),
      tagline: editSvcDraft.tagline.trim(),
      icon: editSvcDraft.icon,
      orderCode: editSvcDraft.orderCode.trim().toUpperCase(),
    }));
    mark(key);
    setEditSvcKey(null);
    notify('Service updated');
  };

  const deleteSvc = (key: string) => {
    setDraft(prev => prev.filter(s => s.key !== key));
    setEditedKeys(s => { const n = new Set(s); n.delete(key); return n; });
    setNewKeys(s => { const n = new Set(s); n.delete(key); return n; });
    setExpanded(s => { const n = new Set(s); n.delete(key); return n; });
    setDirty(draft.length > 1); // still dirty if other services remain
    setConfirmDelSvc(null);
    setEditSvcKey(null);
    notify('Service deleted');
  };

  const publish = () => {
    setDirty(false);
    setEditedKeys(new Set());
    setNewKeys(new Set());
    notify('Catalog published ✓');
  };

  // ── feature list helpers ──
  const setFeature    = (i: number, v: string) => setDraftPkg(p => { const f = [...p.features]; f[i] = v; return { ...p, features: f }; });
  const addFeature    = ()                      => setDraftPkg(p => ({ ...p, features: [...p.features, ''] }));
  const removeFeature = (i: number)             => setDraftPkg(p => ({ ...p, features: p.features.filter((_, j) => j !== i) }));

  return (
    <section className="space-y-4">
      {/* page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Catalog</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Services, packages &amp; prices</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setAddSvcDraft(EMPTY_SVC); setAddSvcOpen(true); }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent"
          >
            <i className="ph-bold ph-plus mr-1.5" aria-hidden />Add service
          </button>
          <button
            onClick={publish}
            disabled={!dirty}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold transition enabled:bg-primary enabled:text-primary-foreground enabled:hover:bg-primary/90 disabled:cursor-default disabled:border disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
          >
            <i className={`ph-bold ${dirty ? 'ph-cloud-arrow-up' : 'ph-check'} mr-1.5`} aria-hidden />
            {dirty ? 'Publish changes' : 'Published'}
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon="ph-squares-four" label="Services"    value={String(draft.length)} />
        <Kpi icon="ph-package"      label="Packages"    value={String(draftTotalPkgs)} />
        <Kpi icon="ph-coins"        label="Price range" value={draftMin > 0 ? `$${draftMin}–$${draftMax}` : '—'} />
        <Kpi icon="ph-check-circle" label="Orderable"   value={String(orderableCount)} tone={orderableCount === draft.length ? 'good' : 'warn'} />
      </div>

      {/* search */}
      <div className="relative">
        <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search services or packages…"
          className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-8 text-sm outline-none focus:border-primary"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <i className="ph-bold ph-x" aria-hidden />
          </button>
        )}
      </div>
      {filtered.length === 0 && search && (
        <p className="py-8 text-center text-sm text-muted-foreground">No services match &ldquo;{search}&rdquo;.</p>
      )}

      {/* performance window */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <i className="ph-bold ph-chart-line-up text-primary" aria-hidden />
          Orders, customers &amp; revenue per package
        </p>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Time range">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                range === r.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* service list */}
      <div className="space-y-3">
        {filtered.map(svc => {
          const isOpen   = expanded.has(svc.key);
          const isNew    = newKeys.has(svc.key);
          const isEdited = editedKeys.has(svc.key) && !isNew;
          const cntLabel = svc.hasUsage ? 'tiered pricing' : `${svc.packageCount} pkg${svc.packageCount !== 1 ? 's' : ''}`;
          return (
            <div key={svc.key} className="overflow-hidden rounded-2xl border border-border bg-card">
              {/* card header */}
              <div className="flex w-full items-center gap-3 px-4 py-3.5">
                {/* expand toggle — takes remaining space */}
                <button
                  onClick={() => toggle(svc.key)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <i className={`ph-fill ${svc.icon} text-primary`} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{svc.name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">{svc.orderCode || '—'}</code>
                      {svc.hasBulk   && <span className="pill text-[10px]"><i className="ph-bold ph-stack" aria-hidden />bulk</span>}
                      {svc.hasUsage  && <span className="pill text-[10px]"><i className="ph-bold ph-chart-line-up" aria-hidden />usage-based</span>}
                      {isNew         && <span className="pill pill-good text-[10px]">new</span>}
                      {isEdited      && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">edited</span>}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{svc.tagline || 'No tagline'}</p>
                  </div>
                </button>

                {/* right controls */}
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="hidden font-semibold text-foreground sm:block">{svc.priceLabel}</span>
                  <span className="hidden sm:block">{cntLabel}</span>
                  <button
                    onClick={e => { e.stopPropagation(); openEditSvc(svc); }}
                    aria-label={`Edit ${svc.name}`}
                    title="Edit service"
                    className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <i className="ph-bold ph-pencil-simple" aria-hidden />
                  </button>
                  <button
                    onClick={() => toggle(svc.key)}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent"
                  >
                    <i className={`ph-bold ph-caret-down transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                </div>
              </div>

              {/* expanded body */}
              {isOpen && (
                <div className="animate-in fade-in duration-150 space-y-4 border-t border-border px-4 pb-4 pt-4">
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold"><i className="ph-bold ph-coins text-primary" aria-hidden />{svc.priceLabel}</span>
                    {!svc.hasUsage && <span className="flex items-center gap-1.5 text-muted-foreground"><i className="ph-bold ph-package" aria-hidden />{svc.packageCount} packages</span>}
                    {svc.hasBulk   && <span className="flex items-center gap-1.5 text-muted-foreground"><i className="ph-bold ph-percent" aria-hidden />Volume discount</span>}
                    {svc.packages.length > 0 && (() => {
                      const ss = svcStats(svc.packages, range);
                      return (
                        <>
                          <span className="flex items-center gap-1.5 text-muted-foreground"><i className="ph-bold ph-receipt" aria-hidden />{ss.orders} orders</span>
                          <span className="flex items-center gap-1.5 text-muted-foreground"><i className="ph-bold ph-users" aria-hidden />{ss.customers} customers</span>
                          <span className="flex items-center gap-1.5 font-semibold"><i className="ph-bold ph-trend-up text-emerald-500" aria-hidden />{fmtMoney(ss.revenue)} · {range}</span>
                          <span className="flex items-center gap-1.5 font-semibold text-emerald-600"><i className="ph-bold ph-crown-simple" aria-hidden />{fmtMoney(svcLtv(svc.packages))} LTV</span>
                        </>
                      );
                    })()}
                  </div>

                  {svc.hasUsage ? (
                    <UsageTiers tiers={svc.usageTiers} />
                  ) : svc.hasGroups ? (
                    <div className="space-y-4">
                      {svc.groups.map(g => (
                        <div key={g.id}>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {g.icon && <i className={`ph-fill ${g.icon}`} aria-hidden />}
                              {g.title}
                              {g.subtitle && <span className="font-normal normal-case tracking-normal text-muted-foreground/70">— {g.subtitle}</span>}
                            </div>
                            <button
                              onClick={() => openAddPkg(svc.key, g.id, g.title)}
                              className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                            >
                              <i className="ph-bold ph-plus" aria-hidden />Add package
                            </button>
                          </div>
                          <PkgTable pkgs={g.packages} featOpen={featOpen} range={range}
                            onToggleFeat={id => setFeatOpen(f => (f === `${svc.key}:${id}` ? null : `${svc.key}:${id}`))}
                            svcKey={svc.key} onEdit={openEditPkg}
                            onDelete={id => setConfirmDelPkg({ svcKey: svc.key, pkgId: id })}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <PkgTable pkgs={svc.packages} featOpen={featOpen} range={range}
                        onToggleFeat={id => setFeatOpen(f => (f === `${svc.key}:${id}` ? null : `${svc.key}:${id}`))}
                        svcKey={svc.key} onEdit={openEditPkg}
                        onDelete={id => setConfirmDelPkg({ svcKey: svc.key, pkgId: id })}
                      />
                      <button
                        onClick={() => openAddPkg(svc.key, null, null)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                      >
                        <i className="ph-bold ph-plus" aria-hidden />Add package to {svc.name}
                      </button>
                    </>
                  )}

                  {svc.addons.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3 text-xs">
                      <span className="mr-0.5 text-muted-foreground">Upsells:</span>
                      {svc.addons.map(a => <span key={a} className="rounded-md border border-border px-2 py-0.5 font-medium">{ADDON_LABEL[a] ?? a}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Package edit / add panel ─── */}
      <SlideOver open={pkgPanel !== null} onClose={() => setPkgPanel(null)} title={pkgPanel?.isNew ? 'Add package' : 'Edit package'}>
        {pkgPanel && (
          <div className="space-y-4">
            {pkgPanel.groupTitle && (
              <p className="text-xs text-muted-foreground">
                Group: <span className="font-semibold text-foreground">{pkgPanel.groupTitle}</span>
              </p>
            )}

            <FormField label="Package name" required>
              <input value={draftPkg.name} onChange={e => setDraftPkg(p => ({ ...p, name: e.target.value }))} className={INPUT} placeholder="e.g. Standard" />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Price ($)" hint="0 = custom">
                <input type="number" min="0" value={draftPkg.price} onChange={e => setDraftPkg(p => ({ ...p, price: e.target.value }))} className={INPUT} placeholder="39" />
              </FormField>
              <FormField label="Price label" hint="optional override">
                <input value={draftPkg.priceLabel} onChange={e => setDraftPkg(p => ({ ...p, priceLabel: e.target.value }))} className={INPUT} placeholder="from $120" />
              </FormField>
            </div>

            <FormField label="SLA" required>
              <input value={draftPkg.sla} onChange={e => setDraftPkg(p => ({ ...p, sla: e.target.value }))} className={INPUT} placeholder="~2–3 days" />
            </FormField>

            <div className="flex cursor-pointer items-center gap-3 text-sm font-medium">
              <button
                role="switch" aria-checked={draftPkg.popular}
                onClick={() => setDraftPkg(p => ({ ...p, popular: !p.popular }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${draftPkg.popular ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${draftPkg.popular ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
              <span onClick={() => setDraftPkg(p => ({ ...p, popular: !p.popular }))}>Mark as popular</span>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Features</p>
              <div className="space-y-1.5">
                {draftPkg.features.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={f} onChange={e => setFeature(i, e.target.value)} className={`${INPUT} flex-1`} placeholder={`Feature ${i + 1}`} />
                    <button onClick={() => removeFeature(i)} aria-label="Remove feature"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive">
                      <i className="ph-bold ph-trash" aria-hidden />
                    </button>
                  </div>
                ))}
                <button onClick={addFeature} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  <i className="ph-bold ph-plus" aria-hidden />Add feature
                </button>
              </div>
            </div>

            <div className="flex gap-2 border-t border-border pt-4">
              <button onClick={savePkg} disabled={!draftPkg.name.trim()}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {pkgPanel.isNew ? 'Add package' : 'Save changes'}
              </button>
              <button onClick={() => setPkgPanel(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">Cancel</button>
            </div>
          </div>
        )}
      </SlideOver>

      {/* ─── Add service panel ─── */}
      <SlideOver open={addSvcOpen} onClose={() => setAddSvcOpen(false)} title="Add service">
        <SvcForm
          draft={addSvcDraft}
          onChange={setAddSvcDraft}
          onSubmit={saveNewSvc}
          onCancel={() => setAddSvcOpen(false)}
          submitLabel="Create service"
          keyReadOnly={false}
        />
      </SlideOver>

      {/* ─── Edit service panel ─── */}
      <SlideOver open={editSvcKey !== null} onClose={() => setEditSvcKey(null)} title="Edit service">
        {editSvcKey && (
          <div className="flex flex-col gap-4">
            <SvcForm
              draft={editSvcDraft}
              onChange={setEditSvcDraft}
              onSubmit={saveEditSvc}
              onCancel={() => setEditSvcKey(null)}
              submitLabel="Save changes"
              keyReadOnly
            />
            <button
              onClick={() => setConfirmDelSvc(editSvcKey)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/40 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5"
            >
              <i className="ph-bold ph-trash" aria-hidden />Delete service
            </button>
          </div>
        )}
      </SlideOver>

      {/* ─── Delete package confirm ─── */}
      {confirmDelPkg && (
        <ConfirmDialog
          title="Delete package?"
          body="This removes it from the catalog. Changes only persist after publishing."
          confirmLabel="Delete"
          onConfirm={() => deletePkg(confirmDelPkg.svcKey, confirmDelPkg.pkgId)}
          onCancel={() => setConfirmDelPkg(null)}
        />
      )}

      {/* ─── Delete service confirm ─── */}
      {confirmDelSvc && (
        <ConfirmDialog
          title="Delete service?"
          body="All packages under this service will be removed. This cannot be undone after publishing."
          confirmLabel="Delete service"
          onConfirm={() => deleteSvc(confirmDelSvc)}
          onCancel={() => setConfirmDelSvc(null)}
        />
      )}

      {/* toast */}
      {toast && (
        <div className="toast-in fixed bottom-4 right-4 z-[90] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">
          <i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" aria-hidden />{toast}
        </div>
      )}
    </section>
  );
}

// ─── Package table ────────────────────────────────────────────────────────────
function PkgTable({ pkgs, featOpen, range, onToggleFeat, svcKey, onEdit, onDelete }: {
  pkgs: PkgRow[];
  featOpen: string | null;
  range: RangeKey;
  onToggleFeat: (id: string) => void;
  svcKey: string;
  onEdit: (svcKey: string, pkg: PkgRow) => void;
  onDelete: (pkgId: string) => void;
}) {
  if (pkgs.length === 0)
    return <p className="rounded-xl border border-dashed border-border py-4 text-center text-xs text-muted-foreground">No packages yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2">Package</th>
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">SLA</th>
            <th className="px-3 py-2 text-right">Orders</th>
            <th className="px-3 py-2 text-right">Customers</th>
            <th className="px-3 py-2 text-right">Revenue</th>
            <th className="px-3 py-2 text-right">LTV</th>
            <th className="px-3 py-2">Features</th>
            <th className="w-16 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {pkgs.map(p => {
            const fk = `${svcKey}:${p.id}`;
            const open = featOpen === fk;
            const stats = pkgStats(p, range);
            return (
              <Fragment key={p.id}>
                <tr className="border-b border-border/50 transition hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <span className="font-medium">{p.name}</span>
                    {p.popular && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">popular</span>}
                  </td>
                  <td className="px-3 py-2 font-semibold">{p.priceLabel}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.sla}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{stats.orders}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{stats.customers}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtMoney(stats.revenue)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-600">{fmtMoney(pkgLtv(p))}</td>
                  <td className="px-3 py-2">
                    {p.features.length > 0 ? (
                      <button onClick={() => onToggleFeat(p.id)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <i className="ph-fill ph-list-checks" aria-hidden />
                        {p.features.length} items
                        <i className={`ph-bold ph-caret-down text-[10px] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
                      </button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onEdit(svcKey, p)} aria-label="Edit package" title="Edit"
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
                        <i className="ph-bold ph-pencil-simple text-[13px]" aria-hidden />
                      </button>
                      <button onClick={() => onDelete(p.id)} aria-label="Delete package" title="Delete"
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <i className="ph-bold ph-trash text-[13px]" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-border/30 bg-muted/10">
                    <td colSpan={9} className="px-4 pb-2.5 pt-1.5">
                      <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                        {p.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <i className="ph-fill ph-check-circle mt-0.5 shrink-0 text-emerald-500" aria-hidden /><span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Usage tier table ─────────────────────────────────────────────────────────
function UsageTiers({ tiers }: { tiers: TierRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2">Tier</th><th className="px-3 py-2">Rate / link</th>
            <th className="px-3 py-2">Volume</th><th className="px-3 py-2">Savings</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => (
            <tr key={i} className="border-b border-border/50 transition hover:bg-muted/20">
              <td className="px-3 py-2 font-medium">{t.label}</td>
              <td className="px-3 py-2 font-semibold">${t.rate.toFixed(3)}/link</td>
              <td className="px-3 py-2 text-muted-foreground">{t.min === 0 ? 'Default' : `${t.min.toLocaleString()}+ links`}</td>
              <td className="px-3 py-2">{t.sub ? <span className="pill pill-good text-[11px]">{t.sub}</span> : <span className="text-muted-foreground">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Service form (shared by Add + Edit) ─────────────────────────────────────
function SvcForm({ draft, onChange, onSubmit, onCancel, submitLabel, keyReadOnly }: {
  draft: DraftSvc;
  onChange: (d: DraftSvc) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  keyReadOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      <FormField label="Service name" required>
        <input
          value={draft.name}
          onChange={e => onChange({ ...draft, name: e.target.value, key: keyReadOnly ? draft.key : (draft.key || e.target.value.toLowerCase().replace(/\s+/g, '-')) })}
          className={INPUT} placeholder="e.g. Link Audit"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Service ID" hint={keyReadOnly ? 'read-only' : 'slug'}>
          <input
            value={draft.key}
            readOnly={keyReadOnly}
            onChange={e => !keyReadOnly && onChange({ ...draft, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            className={`${INPUT} font-mono text-sm ${keyReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
            placeholder="link-audit"
          />
        </FormField>
        <FormField label="Order code" hint="prefix">
          <input
            value={draft.orderCode}
            onChange={e => onChange({ ...draft, orderCode: e.target.value.toUpperCase().slice(0, 5) })}
            className={`${INPUT} font-mono font-bold tracking-widest`} placeholder="LA"
          />
        </FormField>
      </div>

      <FormField label="Tagline">
        <textarea
          value={draft.tagline}
          onChange={e => onChange({ ...draft, tagline: e.target.value })}
          rows={2} className={`${INPUT} resize-none`} placeholder="One-line description shown to customers"
        />
      </FormField>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Icon</p>
        <div className="grid grid-cols-8 gap-1.5">
          {ICON_OPTIONS.map(ic => (
            <button key={ic} onClick={() => onChange({ ...draft, icon: ic })} title={ic.replace('ph-', '')}
              className={`grid h-9 w-full place-items-center rounded-lg border transition ${draft.icon === ic ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
              <i className={`ph-fill ${ic}`} aria-hidden />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-t border-border pt-4">
        <button onClick={onSubmit} disabled={!draft.name.trim() || !draft.key.trim()}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {submitLabel}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">Cancel</button>
      </div>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={onConfirm}
            className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white hover:bg-destructive/90">{confirmLabel}</button>
          <button onClick={onCancel}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold hover:bg-accent">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared form helpers ──────────────────────────────────────────────────────
function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        {hint && <span className="ml-1 font-normal normal-case tracking-normal">— {hint}</span>}
      </p>
      {children}
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${col}`} aria-hidden />
      </div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
