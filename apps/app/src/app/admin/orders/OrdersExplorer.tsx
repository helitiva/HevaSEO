'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { statusLabel, money, TIER, type AdminOrder, type OrderStatus, type Tier } from '@/data/adminMock';

export interface ExplorerOrder extends AdminOrder {
  seq: number; custName: string; custTier: Tier; custLtv: number; custOrders: number;
}

const SORTS = [
  { value: 'created_desc', label: 'Newest' },
  { value: 'created_asc', label: 'Oldest' },
  { value: 'seq_asc', label: 'Order # ↑' },
  { value: 'value_desc', label: 'Order value ↓' },
  { value: 'value_asc', label: 'Order value ↑' },
  { value: 'ltv_desc', label: 'Customer LTV ↓' },
];

type ColId = 'seq' | 'date' | 'code' | 'customer' | 'service' | 'status' | 'priority' | 'value' | 'ltv' | 'orders';

interface ColDef { label: string; align?: 'right'; render: (o: ExplorerOrder) => ReactNode; }
const COLDEF: Record<ColId, ColDef> = {
  seq: { label: 'Order #', render: (o) => <span className="font-semibold text-muted-foreground">#{o.seq}</span> },
  date: { label: 'Date', render: (o) => <span className="text-muted-foreground">{o.created.slice(5)}</span> },
  code: { label: 'Code', render: (o) => <span className="font-medium">{o.code}</span> },
  customer: { label: 'Customer', render: (o) => (
    <span className="flex flex-col">
      <span className="flex items-center gap-1.5"><span className="font-medium">{o.custName}</span><TierBadge tier={o.custTier} /></span>
      <span className="text-[11px] text-muted-foreground">{o.customer}</span>
    </span>
  ) },
  service: { label: 'Service', render: (o) => <>{o.service} <span className="text-muted-foreground">· {o.pkg}</span></> },
  status: { label: 'Status', render: (o) => <StatusBadge status={o.status} /> },
  priority: { label: 'Priority', render: (o) => <PriorityBadge priority={o.priority} /> },
  value: { label: 'Value', align: 'right', render: (o) => money(o.value) },
  ltv: { label: 'LTV', align: 'right', render: (o) => <span className="font-semibold">{money(o.custLtv)}</span> },
  orders: { label: 'Orders', align: 'right', render: (o) => o.custOrders },
};
const DEFAULT_ORDER: ColId[] = ['seq', 'date', 'code', 'customer', 'service', 'status', 'priority', 'value', 'ltv', 'orders'];

function TierBadge({ tier }: { tier: Tier }) {
  const t = TIER[tier];
  return (
    <span className="inline-flex items-center gap-1" title={`${t.label} customer`}>
      <i className={`ph-fill ${t.icon}`} style={{ color: t.color }} />
      <span className="text-[10px] font-semibold" style={{ color: t.color }}>{t.label}</span>
    </span>
  );
}

export function OrdersExplorer({ rows }: { rows: ExplorerOrder[] }) {
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [tier, setTier] = useState('');
  const [source, setSource] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('created_desc');

  const [colOrder, setColOrder] = useState<ColId[]>(DEFAULT_ORDER);
  const [hidden, setHidden] = useState<Set<ColId>>(new Set());
  const [showCols, setShowCols] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const services = useMemo(() => [...new Set(rows.map((o) => o.service))].sort(), [rows]);
  const counts = useMemo(() => rows.reduce<Record<string, number>>((a, o) => ({ ...a, [o.status]: (a[o.status] ?? 0) + 1 }), {}), [rows]);
  const statusesPresent = useMemo(() => (Object.keys(statusLabel) as OrderStatus[]).filter((s) => counts[s]), [counts]);

  const filtered = useMemo(() => rows
    .filter((o) => (!status || o.status === status)
      && (!service || o.service === service)
      && (!tier || o.custTier === tier)
      && (!source || o.source === source)
      && (!priority || o.priority === priority)
      && (!from || o.created >= from)
      && (!to || o.created <= to)
      && (!search || `${o.code} ${o.customer} ${o.custName}`.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      switch (sort) {
        case 'seq_asc': return a.seq - b.seq;
        case 'value_desc': return b.value - a.value;
        case 'value_asc': return a.value - b.value;
        case 'ltv_desc': return b.custLtv - a.custLtv;
        case 'created_asc': return a.created.localeCompare(b.created);
        default: return b.created.localeCompare(a.created);
      }
    }), [rows, status, service, tier, source, priority, from, to, search, sort]);

  const hasFilter = status || service || tier || source || priority || search || from || to;
  const clear = () => { setStatus(''); setService(''); setTier(''); setSource(''); setPriority(''); setSearch(''); setFrom(''); setTo(''); };

  const columns: Column<ExplorerOrder>[] = colOrder
    .filter((id) => !hidden.has(id))
    .map((id) => ({ key: id, header: id === 'seq' ? '#' : COLDEF[id].label, align: COLDEF[id].align, render: COLDEF[id].render }));

  function reorder(to: number) {
    const fromIdx = dragIdx.current;
    if (fromIdx == null || fromIdx === to) return;
    setColOrder((prev) => { const n = [...prev]; const [m] = n.splice(fromIdx, 1); n.splice(to, 0, m); return n; });
    dragIdx.current = null;
  }
  const toggleHidden = (id: ColId) => setHidden((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const sel = 'rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary';

  return (
    <div className="space-y-3">
      {/* status chips */}
      <div className="flex flex-wrap gap-2">
        <Chip active={!status} onClick={() => setStatus('')}>All <span className="opacity-70">{rows.length}</span></Chip>
        {statusesPresent.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? '' : s)}>
            {statusLabel[s]} <span className="opacity-70">{counts[s]}</span>
          </Chip>
        ))}
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
          <i className="ph-bold ph-magnifying-glass text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or customer…" className="w-full bg-transparent outline-none" />
        </div>
        <select value={service} onChange={(e) => setService(e.target.value)} className={sel}><option value="">All services</option>{services.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={tier} onChange={(e) => setTier(e.target.value)} className={sel}><option value="">All tiers</option>{(['vip', 'gold', 'silver', 'new'] as Tier[]).map((t) => <option key={t} value={t}>{TIER[t].label}</option>)}</select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={sel}><option value="">All sources</option><option value="quick">Quick</option><option value="dashboard">Dashboard</option></select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={sel}><option value="">All priority</option><option value="high">High</option><option value="med">Med</option><option value="low">Low</option></select>
        <label className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs"><span className="text-muted-foreground">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent outline-none" /></label>
        <label className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs"><span className="text-muted-foreground">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent outline-none" /></label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={sel}>{SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        {hasFilter && <button type="button" onClick={clear} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>}

        {/* column manager */}
        <div className="relative">
          <button type="button" onClick={() => setShowCols((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:border-primary/50">
            <i className="ph-bold ph-columns" /> Columns
          </button>
          {showCols && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCols(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border bg-card p-2 shadow-xl">
                <p className="px-1.5 pb-1.5 text-[11px] font-semibold text-muted-foreground">Show &amp; drag to reorder</p>
                {colOrder.map((id, i) => (
                  <div key={id} draggable onDragStart={() => { dragIdx.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => reorder(i)}
                    className="flex cursor-grab items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted active:cursor-grabbing">
                    <i className="ph-bold ph-dots-six-vertical text-muted-foreground" />
                    <input type="checkbox" checked={!hidden.has(id)} onChange={() => toggleHidden(id)} className="h-3.5 w-3.5 accent-primary" />
                    <span className="flex-1">{COLDEF[id].label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {rows.length} orders</p>
      <DataTable columns={columns} rows={filtered} onRowHref={(o) => `/admin/orders/${o.id}`} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>
      {children}
    </button>
  );
}
