'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/shared/StatBadge';
import { money, statusLabel, TIER, type OrderStatus, type Tier } from '@/data/adminMock';
import { impersonateCustomer } from '@/lib/impersonation';

interface OrderRow { id: string; code: string; service: string; pkg: string; status: OrderStatus; value: number; created: string }
interface Project { name: string; site: string; folders: { name: string; orders: number }[] }
interface MixRow { service: string; count: number; value: number }
interface Ledger { at: string; delta: number; reason: string }
interface Ticket { id: string; subject: string; status: string; priority: string; age: string }
interface Activity { id: string; at: string; type: string; text: string }
const ACT_ICON: Record<string, { icon: string; color: string }> = {
  login: { icon: 'ph-sign-in', color: 'text-sky-500' },
  order: { icon: 'ph-package', color: 'text-primary' },
  payment: { icon: 'ph-arrow-down-left', color: 'text-emerald-500' },
  debit: { icon: 'ph-arrow-up-right', color: 'text-muted-foreground' },
  account: { icon: 'ph-user-circle-plus', color: 'text-violet-500' },
};

interface Props {
  cust: { id: string; name: string; company: string; email: string; status: string; tier: Tier; spend: number; orders: number; balance: number; lastActive: string };
  contact: { phone: string; timezone: string; memberSince: string; tags: string[] };
  churnDays: number; aov: number; active: number;
  orders: OrderRow[]; projects: Project[]; mix: MixRow[]; ledger: Ledger[]; tickets: Ticket[]; activity: Activity[];
}

const MIX_COLOR = ['#2563eb', '#10b981', '#38bdf8', '#a78bfa', '#f59e0b', '#fb923c', '#34d399'];

export function CustomerProfileClient(p: Props) {
  const c = p.cust;
  const [balance, setBalance] = useState(c.balance);
  const [ledger, setLedger] = useState(p.ledger);
  const [notes, setNotes] = useState<{ at: string; body: string }[]>([{ at: p.contact.memberSince, body: 'High-value client — prioritise turnaround on their orders.' }]);
  const [note, setNote] = useState('');
  const [statusF, setStatusF] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmt, setAdjustAmt] = useState('50');
  const [mixBy, setMixBy] = useState<'value' | 'orders'>('value');

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const addNote = () => { if (!note.trim()) return; setNotes((n) => [{ at: 'just now', body: note.trim() }, ...n]); setNote(''); notify('Internal note added'); };
  const applyAdjust = () => { const amt = Number(adjustAmt) || 0; setBalance((b) => b + amt); setLedger((l) => [{ at: 'just now', delta: amt, reason: 'Manual adjustment' }, ...l]); notify(`Credit ${amt >= 0 ? '+' : ''}${money(amt)}`); setAdjustOpen(false); };

  const filteredOrders = useMemo(() => (statusF ? p.orders.filter((o) => o.status === statusF) : p.orders), [p.orders, statusF]);
  const statuses = useMemo(() => [...new Set(p.orders.map((o) => o.status))], [p.orders]);
  const mixSum = p.mix.reduce((s, m) => s + (mixBy === 'value' ? m.value : m.count), 0) || 1;
  const mixRows = [...p.mix].sort((a, b) => (mixBy === 'value' ? b.value - a.value : b.count - a.count));
  const t = TIER[c.tier];
  const atRisk = p.churnDays > 30;

  return (
    <section className="space-y-4">
      {/* header */}
      <div className="rounded-2xl border border-border bg-card p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin/customers" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent" title="Back"><i className="ph-bold ph-arrow-left" /></Link>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-base font-bold text-primary">{c.name.split(' ').map((x) => x[0]).join('')}</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="display text-xl font-bold tracking-tight">{c.name}</span>
                <span className="inline-flex items-center gap-1" title={`${t.label} customer`}><i className={`ph-fill ${t.icon}`} style={{ color: t.color }} /><span className="text-[11px] font-semibold" style={{ color: t.color }}>{t.label}</span></span>
                <span className={`pill ${c.status === 'claimed' ? 'pill-live' : 'pill'}`}>{c.status}</span>
                {atRisk && <span className="pill pill-warn">churn risk</span>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{c.company} · {c.email} · member since {p.contact.memberSince}</p>
              {p.contact.tags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{p.contact.tags.map((tag) => <span key={tag} className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{tag}</span>)}</div>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`mailto:${c.email}`} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-envelope-simple mr-1" />Email</a>
            <button onClick={() => setAdjustOpen(true)} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent">Adjust credit</button>
            <button onClick={() => impersonateCustomer(c.id)} title={`Open the customer portal as ${c.company}`} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-user-switch mr-1" aria-hidden />Impersonate</button>
            <Menu items={[{ icon: 'ph-tag', label: 'Add tag', fn: () => notify('Tag added') }, { icon: 'ph-git-merge', label: 'Merge duplicate', fn: () => notify('Merge — pick a duplicate') }, { icon: 'ph-prohibit', label: 'Suspend', fn: () => notify('Customer suspended'), danger: true }]} />
          </div>
        </div>
      </div>

      {/* KPI strip — relationship & health */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon="ph-coins" label="Lifetime value" value={money(c.spend)} tone="good" />
        <Kpi icon="ph-wallet" label="Credit" value={money(balance)} />
        <Kpi icon="ph-package" label="Total orders" value={String(c.orders)} />
        <Kpi icon="ph-receipt" label="Avg order" value={money(p.aov)} />
        <Kpi icon="ph-spinner-gap" label="Active now" value={String(p.active)} />
        <Kpi icon="ph-pulse" label="Last order" value={`${p.churnDays}d ago`} tone={atRisk ? 'warn' : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* main */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card icon="ph-folders" title="Projects & folders">
            <div className="space-y-3">
              {p.projects.map((pr) => (
                <div key={pr.name} className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-sm font-semibold"><i className="ph-bold ph-globe-hemisphere-west text-primary" /> {pr.name} <span className="font-normal text-muted-foreground">· {pr.site}</span></p>
                    <span className="text-xs text-muted-foreground">{pr.folders.reduce((s, f) => s + f.orders, 0)} orders</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pr.folders.map((f) => (
                      <span key={f.name} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs"><i className="ph-bold ph-folder text-muted-foreground" />{f.name} <b className="text-primary">{f.orders}</b></span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card icon="ph-package" title="Orders" right={
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"><option value="">All ({p.orders.length})</option>{statuses.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}</select>
          }>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="p-2">Code</th><th className="p-2">Service</th><th className="p-2">Status</th><th className="p-2 text-right">Value</th><th className="p-2">Date</th></tr></thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-muted/40"><td className="p-2"><Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.code}</Link></td><td className="p-2">{o.service} <span className="text-muted-foreground">· {o.pkg}</span></td><td className="p-2"><StatusBadge status={o.status} /></td><td className="p-2 text-right font-semibold">{money(o.value)}</td><td className="p-2 text-muted-foreground">{o.created.slice(5)}</td></tr>
                  ))}
                  {filteredOrders.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No orders.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="ph-chart-donut" title="Service mix" right={
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
              {(['value', 'orders'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setMixBy(k)} className={`rounded-md px-2 py-0.5 capitalize transition ${mixBy === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{k === 'value' ? 'Value' : 'Orders'}</button>
              ))}
            </div>
          }>
            <div className="space-y-2.5">
              {mixRows.map((m, i) => { const pct = Math.round(((mixBy === 'value' ? m.value : m.count) / mixSum) * 100); return (
                <div key={m.service}>
                  <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium"><span className="legend-dot" style={{ background: MIX_COLOR[i % MIX_COLOR.length] }} />{m.service}</span><span className="text-muted-foreground">{m.count} orders · {money(m.value)} · <b className="text-foreground">{pct}%</b></span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: MIX_COLOR[i % MIX_COLOR.length] }} /></div>
                </div>
              ); })}
            </div>
          </Card>

          <Card icon="ph-scroll" title="Activity">
            <ul className="space-y-2.5">
              {p.activity.map((a) => {
                const m = ACT_ICON[a.type] ?? { icon: 'ph-dot', color: 'text-muted-foreground' };
                return (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted"><i className={`ph-bold ${m.icon} ${m.color}`} /></span>
                    <span className="min-w-0 flex-1 truncate">{a.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{a.at}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* sidebar */}
        <div className="min-w-0 space-y-4">
          <Card icon="ph-address-book" title="Contact">
            <div className="space-y-1.5 text-sm">
              <Row label="Email" value={<a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a>} />
              <Row label="Phone" value={p.contact.phone} />
              <Row label="Company" value={c.company} />
              <Row label="Timezone" value={p.contact.timezone} />
              <Row label="Last active" value={c.lastActive} />
            </div>
            {c.id && <Link href="#" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">Edit profile</Link>}
          </Card>

          <Card icon="ph-wallet" title="Credit & ledger" right={<button onClick={() => setAdjustOpen(true)} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-accent">Adjust</button>}>
            <p className="display text-2xl font-bold">{money(balance)}<span className="ml-1 text-xs font-medium text-muted-foreground">balance</span></p>
            <div className="mt-3 space-y-1.5">
              {ledger.slice(0, 6).map((l, i) => (
                <div key={i} className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{l.at} · {l.reason}</span><span className={l.delta >= 0 ? 'font-semibold text-emerald-500' : 'font-semibold'}>{l.delta >= 0 ? '+' : ''}{money(l.delta)}</span></div>
              ))}
            </div>
          </Card>

          <Card icon="ph-note-pencil" title="Internal notes">
            <div className="space-y-1.5">
              {notes.map((n, i) => <div key={i} className="rounded-lg border border-border bg-background/40 p-2 text-sm"><p className="text-[10px] text-muted-foreground">{n.at}</p><p>{n.body}</p></div>)}
            </div>
            <div className="mt-2 flex items-center gap-2"><input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Add a note…" className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary" /><button onClick={addNote} className="rounded-lg bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground">Add</button></div>
          </Card>

          <Card icon="ph-lifebuoy" title="Tickets" right={<Link href="/admin/tickets" className="text-xs font-semibold text-primary hover:underline">Inbox</Link>}>
            {p.tickets.length ? <ul className="space-y-2">{p.tickets.map((tk) => <li key={tk.id} className="text-sm"><p className="font-medium">{tk.subject}</p><p className="text-[11px] text-muted-foreground">{tk.status} · {tk.priority} · {tk.age}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No tickets.</p>}
          </Card>
        </div>
      </div>

      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl"><i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" />{toast}</div>}
      {adjustOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <div className="order-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setAdjustOpen(false)} />
          <div className="modal-in relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="display mb-3 text-base font-bold">Adjust credit</p>
            <label className="text-xs text-muted-foreground">Amount (negative to deduct)</label>
            <input type="number" value={adjustAmt} onChange={(e) => setAdjustAmt(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            <p className="mt-2 text-xs text-muted-foreground">Balance {money(balance)} → <b className="text-foreground">{money(balance + (Number(adjustAmt) || 0))}</b></p>
            <button onClick={applyAdjust} className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">Apply</button>
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${col}`} />
      </div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{right}</div>{children}</div>;
}
function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 truncate text-right font-medium">{value}</span></div>;
}
function Menu({ items }: { items: { icon: string; label: string; fn: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent" aria-label="More"><i className="ph-bold ph-dots-three-outline" /></button>
      {open && (<><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} /><div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl">{items.map((i) => <button key={i.label} onClick={() => { i.fn(); setOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted ${i.danger ? 'text-destructive' : ''}`}><i className={`ph-bold ${i.icon} ${i.danger ? '' : 'text-muted-foreground'}`} /> {i.label}</button>)}</div></>)}
    </div>
  );
}
