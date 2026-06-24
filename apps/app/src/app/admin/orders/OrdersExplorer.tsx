'use client';

import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { statusLabel, money, TIER, STAFF, customerByCompany, type AdminOrder, type OrderStatus, type Tier } from '@/data/adminMock';

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

type ColId = 'seq' | 'date' | 'code' | 'customer' | 'service' | 'status' | 'priority' | 'staff' | 'value' | 'ltv' | 'orders';
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
  staff: { label: 'Staff', render: (o) => o.staff ?? <span className="text-muted-foreground">Unassigned</span> },
  value: { label: 'Value', align: 'right', render: (o) => money(o.value) },
  ltv: { label: 'LTV', align: 'right', render: (o) => <span className="font-semibold">{money(o.custLtv)}</span> },
  orders: { label: 'Orders', align: 'right', render: (o) => o.custOrders },
};
const DEFAULT_ORDER: ColId[] = ['seq', 'date', 'code', 'customer', 'service', 'status', 'priority', 'staff', 'value', 'ltv', 'orders'];

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
  const [staffF, setStaffF] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('created_desc');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [colOrder, setColOrder] = useState<ColId[]>(DEFAULT_ORDER);
  const [hidden, setHidden] = useState<Set<ColId>>(new Set());
  const [showCols, setShowCols] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const services = useMemo(() => [...new Set(rows.map((o) => o.service))].sort(), [rows]);
  const staffList = useMemo(() => [...new Set(rows.map((o) => o.staff).filter((s): s is string => !!s))].sort(), [rows]);
  const counts = useMemo(() => rows.reduce<Record<string, number>>((a, o) => ({ ...a, [o.status]: (a[o.status] ?? 0) + 1 }), {}), [rows]);
  const statusesPresent = useMemo(() => (Object.keys(statusLabel) as OrderStatus[]).filter((s) => counts[s]), [counts]);

  const filtered = useMemo(() => rows
    .filter((o) => (!status || o.status === status)
      && (!service || o.service === service)
      && (!tier || o.custTier === tier)
      && (!source || o.source === source)
      && (!priority || o.priority === priority)
      && (!staffF || (staffF === '__un' ? !o.staff : o.staff === staffF))
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
    }), [rows, status, service, tier, source, priority, staffF, from, to, search, sort]);

  const hasFilter = status || service || tier || source || priority || staffF || search || from || to;
  const clear = () => { setStatus(''); setService(''); setTier(''); setSource(''); setPriority(''); setStaffF(''); setSearch(''); setFrom(''); setTo(''); };

  const columns = colOrder.filter((id) => !hidden.has(id)).map((id) => ({ id, ...COLDEF[id], header: id === 'seq' ? '#' : COLDEF[id].label }));

  function reorder(toIdx: number) {
    const fromIdx = dragIdx.current;
    if (fromIdx == null || fromIdx === toIdx) return;
    setColOrder((prev) => { const n = [...prev]; const [m] = n.splice(fromIdx, 1); n.splice(toIdx, 0, m); return n; });
    dragIdx.current = null;
  }
  const toggleHidden = (id: ColId) => setHidden((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const sel = 'rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Chip active={!status} onClick={() => setStatus('')}>All <span className="opacity-70">{rows.length}</span></Chip>
        {statusesPresent.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? '' : s)}>{statusLabel[s]} <span className="opacity-70">{counts[s]}</span></Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
          <i className="ph-bold ph-magnifying-glass text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or customer…" className="w-full bg-transparent outline-none" />
        </div>
        <select value={service} onChange={(e) => setService(e.target.value)} className={sel}><option value="">All services</option>{services.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={tier} onChange={(e) => setTier(e.target.value)} className={sel}><option value="">All tiers</option>{(['vip', 'gold', 'silver', 'new'] as Tier[]).map((t) => <option key={t} value={t}>{TIER[t].label}</option>)}</select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={sel}><option value="">All sources</option><option value="quick">Quick</option><option value="dashboard">Dashboard</option></select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={sel}><option value="">All priority</option><option value="high">High</option><option value="med">Med</option><option value="low">Low</option></select>
        <select value={staffF} onChange={(e) => setStaffF(e.target.value)} className={sel}><option value="">All staff</option><option value="__un">Unassigned</option>{staffList.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <label className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs"><span className="text-muted-foreground">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent outline-none" /></label>
        <label className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs"><span className="text-muted-foreground">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent outline-none" /></label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={sel}>{SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        {hasFilter && <button type="button" onClick={clear} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>}

        <div className="relative">
          <button type="button" onClick={() => setShowCols((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:border-primary/50"><i className="ph-bold ph-columns" /> Columns</button>
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

      <p className="text-xs text-muted-foreground">{filtered.length} of {rows.length} orders · click a row to expand</p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              {columns.map((c) => <th key={c.id} className={`p-2.5 ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>)}
              <th className="w-8 p-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const open = expanded === o.id;
              return (
                <Fragment key={o.id}>
                  <tr onClick={() => setExpanded(open ? null : o.id)} className={`cursor-pointer border-b border-border/50 transition hover:bg-muted/40 ${open ? 'bg-muted/30' : ''}`}>
                    {columns.map((c) => <td key={c.id} className={`p-2.5 ${c.align === 'right' ? 'text-right' : ''}`}>{c.render(o)}</td>)}
                    <td className="p-2.5 text-muted-foreground"><i className={`ph-bold ${open ? 'ph-caret-up' : 'ph-caret-down'}`} /></td>
                  </tr>
                  {open && (
                    <tr className="border-b border-border bg-background/40">
                      <td colSpan={columns.length + 1} className="p-0"><ExpandedRow o={o} rows={rows} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">No orders match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpandedRow({ o, rows }: { o: ExplorerOrder; rows: ExplorerOrder[] }) {
  const custRows = rows.filter((r) => r.customer === o.customer);
  const totOrders = custRows.length;
  const totValue = custRows.reduce((s, r) => s + r.value, 0);
  const mix = Object.values(custRows.reduce<Record<string, { service: string; count: number; value: number }>>((a, r) => {
    a[r.service] = a[r.service] ?? { service: r.service, count: 0, value: 0 };
    a[r.service].count += 1; a[r.service].value += r.value; return a;
  }, {})).sort((a, b) => b.value - a.value);

  const staff = STAFF.find((s) => s.name === o.staff);
  const cust = customerByCompany(o.customer);
  const site = cust?.email.split('@')[1] ?? `${o.customer.toLowerCase().replace(/\s+/g, '')}.com`;
  const overdue = o.deadline && o.deadline < new Date().toISOString().slice(0, 10) && o.status !== 'completed' && o.status !== 'canceled';

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      {/* Customer */}
      <Section icon="ph-user" title="Customer">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-semibold">{o.custName}</span><TierBadge tier={o.custTier} />
          <span className={`pill ${cust?.status === 'claimed' ? 'pill-live' : 'pill'}`}>{cust?.status ?? 'shadow'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="Total orders" value={String(o.custOrders)} />
          <Stat label="Total value (LTV)" value={money(o.custLtv)} />
          <Stat label="Services used" value={String(mix.length)} />
          <Stat label="Credit balance" value={money(cust?.balance ?? 0)} />
        </div>
        <p className="mb-1 mt-3 text-[11px] font-semibold text-muted-foreground">Service mix · by order / value</p>
        <div className="space-y-1.5">
          {mix.map((m) => {
            const cPct = Math.round((m.count / totOrders) * 100);
            const vPct = Math.round((m.value / (totValue || 1)) * 100);
            return (
              <div key={m.service} className="text-xs">
                <div className="flex justify-between"><span className="font-medium">{m.service}</span><span className="text-muted-foreground">{m.count} ord · {cPct}% / {money(m.value)} · {vPct}%</span></div>
                <div className="mt-0.5 flex gap-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sky-500" style={{ width: `${cPct}%` }} /></div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${vPct}%` }} /></div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground"><span className="text-sky-500">▬</span> by order · <span className="text-emerald-500">▬</span> by value</p>
      </Section>

      {/* Staff */}
      <Section icon="ph-user-gear" title="Assigned staff">
        {staff ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">{staff.name}</span>
              <span className="display text-2xl font-bold text-primary">{staff.composite}<span className="text-[11px] font-medium text-muted-foreground"> score</span></span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Completed" value={`${staff.throughput} orders`} />
              <Stat label="Quality" value={`${staff.quality}%`} />
              <Stat label="On-time" value={`${staff.onTime}%`} />
              <Stat label="Current load" value={`${staff.openLoad}/${staff.capacity}`} />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Skills</p>
            <div className="mt-1 flex flex-wrap gap-1">{staff.skills.map((k) => <span key={k} className="pill pill-good">{k}</span>)}</div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Unassigned — will auto-route to a qualified staff on confirm.</p>
        )}
      </Section>

      {/* Order */}
      <Section icon="ph-package" title="Order details">
        <div className="space-y-2 text-sm">
          <Row label="Project" value={`${o.customer} — SEO program`} />
          <Row label="Site" value={site} />
          <Row label="Target URL" value={<a href={`https://${site}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://{site}</a>} />
          <Row label="Service" value={`${o.service} · ${o.pkg}`} />
          <Row label="Value" value={<span className="font-semibold">{money(o.value)}</span>} />
          <Row label="Source" value={o.source} />
          <Row label="Deadline" value={<span className={overdue ? 'font-semibold text-amber-500' : ''}>{o.deadline ?? '—'}{overdue ? ' · overdue' : ''}</span>} />
        </div>
        <Link href={`/admin/orders/${o.id}`} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Open full detail <i className="ph-bold ph-arrow-right" /></Link>
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-background/40 p-2"><p className="display text-base font-bold leading-none">{value}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p></div>;
}
function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="shrink-0 text-muted-foreground">{label}</span><span className="truncate text-right font-medium">{value}</span></div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>{children}</button>
  );
}
