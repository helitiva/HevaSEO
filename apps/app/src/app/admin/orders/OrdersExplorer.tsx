'use client';

import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { statusLabel, money, TIER, type AdminOrder, type OrderStatus, type Tier } from '@/data/adminMock';

export interface ExplorerOrder extends AdminOrder {
  custName: string; custTier: Tier; custLtv: number; custOrders: number;
}

const SORTS = [
  { value: 'created_desc', label: 'Newest' },
  { value: 'created_asc', label: 'Oldest' },
  { value: 'value_desc', label: 'Order value ↓' },
  { value: 'value_asc', label: 'Order value ↑' },
  { value: 'ltv_desc', label: 'Customer LTV ↓' },
];

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
        case 'value_desc': return b.value - a.value;
        case 'value_asc': return a.value - b.value;
        case 'ltv_desc': return b.custLtv - a.custLtv;
        case 'created_asc': return a.created.localeCompare(b.created);
        default: return b.created.localeCompare(a.created);
      }
    }), [rows, status, service, tier, source, priority, from, to, search, sort]);

  const hasFilter = status || service || tier || source || priority || search || from || to;
  const clear = () => { setStatus(''); setService(''); setTier(''); setSource(''); setPriority(''); setSearch(''); setFrom(''); setTo(''); };

  const columns: Column<ExplorerOrder>[] = [
    { key: 'code', header: 'Code', render: (o) => <span className="font-medium">{o.code}</span> },
    { key: 'customer', header: 'Customer', render: (o) => (
      <span className="flex flex-col">
        <span className="flex items-center gap-1.5"><span className="font-medium">{o.custName}</span><TierBadge tier={o.custTier} /></span>
        <span className="text-[11px] text-muted-foreground">{o.customer}</span>
      </span>
    ) },
    { key: 'service', header: 'Service', render: (o) => <>{o.service} <span className="text-muted-foreground">· {o.pkg}</span></> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'priority', header: 'Priority', render: (o) => <PriorityBadge priority={o.priority} /> },
    { key: 'value', header: 'Value', align: 'right', render: (o) => money(o.value) },
    { key: 'ltv', header: 'LTV', align: 'right', render: (o) => <span className="font-semibold">{money(o.custLtv)}</span> },
    { key: 'orders', header: 'Orders', align: 'right', render: (o) => o.custOrders },
    { key: 'created', header: 'Created', render: (o) => <span className="text-muted-foreground">{o.created.slice(5)}</span> },
  ];

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
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {rows.length} orders</p>
      <DataTable columns={columns} rows={filtered} onRowHref={(o) => `/admin/orders/${o.id}`} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>
      {children}
    </button>
  );
}
