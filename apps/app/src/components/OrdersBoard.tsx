'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ORDERS, SERVICES, STATUSES, PRIORITIES,
  type Order, type OrderStatus, type ServiceKey,
} from '@/data/mock';

const COLS: OrderStatus[] = ['planned', 'progress', 'review', 'completed'];
const DOT: Record<OrderStatus, string> = {
  planned: 'bg-slate-400', progress: 'bg-primary', review: 'bg-amber-500', completed: 'bg-emerald-500',
};

function OrderCard({ o }: { o: Order }) {
  const done = o.status === 'completed';
  return (
    <Link href={`/projects?p=${encodeURIComponent(o.domain)}`} className={`kcard onav block${done ? ' opacity-90' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold">{o.title}</h4>
        {done
          ? <i className="ph-fill ph-check-circle text-emerald-500" />
          : <span className={`prio prio-${o.priority}`}>{PRIORITIES[o.priority]}</span>}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <i className={`ph-bold ${SERVICES[o.service].icon}`} /> {o.domain} · {o.sub}
      </p>
      <p className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold text-foreground/70">#{o.id}</span>
        <span className="inline-flex items-center gap-1"><i className="ph-bold ph-calendar-blank" /> {o.date}</span>
      </p>
      {o.progress != null ? (
        <>
          <div className="bar mt-2"><i style={{ width: `${o.progress}%` }} /></div>
          <p className={`mt-1.5 text-right text-[11px] font-bold ${done ? 'text-emerald-600' : 'text-primary'}`}>{o.progress}%</p>
        </>
      ) : (
        <p className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{o.detail}</span>
          <b className={done ? 'text-emerald-600' : 'text-foreground'}>{o.eta}</b>
        </p>
      )}
    </Link>
  );
}

export function OrdersBoard({ initialService = 'all' }: { initialService?: ServiceKey | 'all' }) {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [svc, setSvc] = useState<ServiceKey | 'all'>(initialService);
  const [proj, setProj] = useState<string>('all');

  const domains = useMemo(() => Array.from(new Set(ORDERS.map((o) => o.domain))).sort(), []);
  const data = useMemo(
    () => ORDERS.filter((o) => (svc === 'all' || o.service === svc) && (proj === 'all' || o.domain === proj)),
    [svc, proj]
  );

  const filters: (ServiceKey | 'all')[] = ['all', ...(Object.keys(SERVICES) as ServiceKey[])];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div>
        <h3 className="display text-lg font-semibold tracking-tight">Service order progress</h3>
        <p className="text-xs text-muted-foreground">Filter by service · click an order to open the project · switch Kanban / List</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((k) => (
            <button
              key={k}
              onClick={() => setSvc(k)}
              className={`filter-btn inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                svc === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent'
              }`}
            >
              <i className={`ph-bold ${k === 'all' ? 'ph-squares-four' : SERVICES[k].icon}`} />
              {k === 'all' ? 'All' : SERVICES[k].label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold">
            <i className="ph-bold ph-globe-hemisphere-west text-muted-foreground" />
            <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Filter by project" className="cursor-pointer bg-transparent pr-1 outline-none">
              <option value="all">All projects</option>
              {domains.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1 text-xs font-medium">
            <button onClick={() => setView('kanban')} className={`rounded-md px-2.5 py-1.5 ${view === 'kanban' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><i className="ph-bold ph-kanban" /> Kanban</button>
            <button onClick={() => setView('list')} className={`rounded-md px-2.5 py-1.5 ${view === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><i className="ph-bold ph-list" /> List</button>
          </div>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="mt-4 grid gap-3 overflow-x-auto sm:grid-cols-2 xl:grid-cols-4">
          {COLS.map((st) => {
            const items = data.filter((o) => o.status === st);
            return (
              <div key={st} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold"><span className={`h-2 w-2 rounded-full ${DOT[st]}`} /> {STATUSES[st].label}</span>
                  <span className="text-xs font-bold text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.length
                    ? items.map((o) => <OrderCard key={o.id} o={o} />)
                    : <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
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
              {data.map((o, i) => (
                <tr key={o.id} className="transition hover:bg-accent/40">
                  <td className="py-3 pr-3 text-center text-xs font-semibold text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-3"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/70">#{o.id}</span></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><i className={`ph-bold ${SERVICES[o.service].icon}`} /></span><div><p className="font-semibold leading-tight">{o.title}</p><p className="text-[11px] text-muted-foreground">{o.sub}</p></div></div></td>
                  <td className="px-3 py-3 text-muted-foreground">{o.domain}</td>
                  <td className="px-3 py-3"><span className="pill" style={{ background: `${STATUSES[o.status].color}1f`, color: STATUSES[o.status].color }}>● {STATUSES[o.status].label}</span></td>
                  <td className="px-3 py-3"><span className="bar inline-block w-24 align-middle"><i style={{ width: `${o.progress ?? (o.status === 'completed' ? 100 : o.status === 'review' ? 95 : 8)}%` }} /></span></td>
                  <td className="px-3 py-3"><span className={`prio prio-${o.priority}`}>{PRIORITIES[o.priority]}</span></td>
                  <td className={`py-3 pl-3 text-right font-semibold${o.status === 'completed' ? ' text-emerald-600' : ''}`}>{o.eta}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No orders for this service.</p>}
        </div>
      )}
    </div>
  );
}
