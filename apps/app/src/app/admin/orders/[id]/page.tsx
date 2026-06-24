import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { ORDERS, AUDIT, STAFF, TIER, customerByCompany, money } from '@/data/adminMock';

const NEXT: Record<string, { label: string; primary?: boolean }[]> = {
  new: [{ label: 'Confirm', primary: true }, { label: 'Cancel' }],
  confirmed: [{ label: 'Assign staff', primary: true }, { label: 'Cancel' }],
  assigned: [{ label: 'Start work', primary: true }],
  in_progress: [{ label: 'Send to internal review', primary: true }],
  internal_review: [{ label: 'Deliver to customer', primary: true }, { label: 'Kick back' }],
  delivered: [{ label: 'Approve', primary: true }, { label: 'Request changes' }],
  changes_requested: [{ label: 'Resume work', primary: true }],
  approved: [{ label: 'Mark completed', primary: true }],
};

const seqMap = new Map(
  [...ORDERS].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const),
);

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = ORDERS.find((o) => o.id === id);
  if (!order) notFound();

  const seq = seqMap.get(order.id) ?? 0;
  const cust = customerByCompany(order.customer);
  const staff = STAFF.find((s) => s.name === order.staff);
  const site = cust?.email.split('@')[1] ?? `${order.customer.toLowerCase().replace(/\s+/g, '')}.com`;
  const actions = NEXT[order.status] ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = order.deadline && order.deadline < today && order.status !== 'completed' && order.status !== 'canceled';
  const submitted = ['delivered', 'approved', 'completed', 'changes_requested'].includes(order.status);
  const timeline = AUDIT.filter((a) => a.change.startsWith(order.code));

  return (
    <section className="space-y-5">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><i className="ph-bold ph-arrow-left" /> Orders</Link>

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="display text-2xl font-bold tracking-tight">{order.code}</span>
            <span className="text-sm font-semibold text-muted-foreground">#{seq}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{order.service} · {order.pkg} · {money(order.value)} · {order.source}</p>
        </div>
        <div className="flex items-center gap-2"><PriorityBadge priority={order.priority} /><StatusBadge status={order.status} /></div>
      </div>

      {/* actions */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Actions</p>
        <div className="flex flex-wrap gap-2">
          {actions.length ? actions.map((a) => (
            <button key={a.label} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${a.primary ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border hover:bg-accent'}`}>{a.label}</button>
          )) : <span className="text-sm text-muted-foreground">No further actions — this order is {order.status}.</span>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* main */}
        <div className="space-y-4 lg:col-span-2">
          <Card icon="ph-package" title="Scope">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Fact label="Project" value={`${order.customer} — SEO program`} />
              <Fact label="Service" value={`${order.service} · ${order.pkg}`} />
              <Fact label="Site" value={site} />
              <Fact label="Target URL" value={<a href={`https://${site}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://{site}</a>} />
              <Fact label="Order value" value={<span className="font-semibold">{money(order.value)}</span>} />
              <Fact label="Source" value={order.source} />
            </div>
            <p className="mt-3 text-[11px] font-semibold text-muted-foreground">Brief</p>
            <p className="text-sm text-muted-foreground">Improve organic visibility for <b className="text-foreground">{site}</b> via {order.service.toLowerCase()}. Target market: US · English.</p>
          </Card>

          <Card icon="ph-seal-check" title="Deliverables">
            {submitted ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center gap-3">
                  <i className="ph-bold ph-file-text text-2xl text-primary" />
                  <div><p className="text-sm font-medium">{order.code}-report-v1.pdf</p><p className="text-[11px] text-muted-foreground">submitted by {order.staff ?? '—'}</p></div>
                </div>
                {order.status === 'delivered' && (
                  <div className="flex gap-2">
                    <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Approve</button>
                    <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Request changes</button>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-muted-foreground">Awaiting submission from staff.</p>}
          </Card>

          <Card icon="ph-chats-circle" title="Messages">
            <div className="space-y-2">
              <Msg who="You (internal)" internal body="Confirmed scope with the client; prioritise the money pages." />
              <Msg who={cust?.name ?? order.customer} body="Looking forward to the first draft — thanks!" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input placeholder="Write a message…" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <button className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Send</button>
            </div>
          </Card>

          <Card icon="ph-scroll" title="Activity">
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {(timeline.length ? timeline : [{ id: 'c', at: `${order.created} 00:00`, action: 'created', change: `${order.code} created` }]).map((a) => (
                <li key={a.id}><span className="text-foreground">{a.at}</span> — {a.action}: {a.change}</li>
              ))}
            </ul>
          </Card>
        </div>

        {/* sidebar */}
        <div className="space-y-4">
          <Card icon="ph-user" title="Customer">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{cust?.name ?? order.customer}</span>
              {cust && <span className="inline-flex items-center gap-1" title={`${TIER[cust.tier].label} customer`}><i className={`ph-fill ${TIER[cust.tier].icon}`} style={{ color: TIER[cust.tier].color }} /><span className="text-[10px] font-semibold" style={{ color: TIER[cust.tier].color }}>{TIER[cust.tier].label}</span></span>}
            </div>
            <p className="text-xs text-muted-foreground">{order.customer}{cust ? ` · ${cust.email}` : ''}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Stat label="Lifetime value" value={money(cust?.spend ?? order.value)} />
              <Stat label="Total orders" value={String(cust?.orders ?? 1)} />
              <Stat label="Credit" value={money(cust?.balance ?? 0)} />
              <Stat label="Status" value={cust?.status ?? 'shadow'} />
            </div>
            {cust && <Link href={`/admin/customers/${cust.id}`} className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">Customer profile →</Link>}
          </Card>

          <Card icon="ph-user-gear" title="Assigned staff">
            {staff ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{staff.name}</span>
                  <span className="display text-xl font-bold text-primary">{staff.composite}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Completed" value={`${staff.throughput}`} />
                  <Stat label="Quality" value={`${staff.quality}%`} />
                  <Stat label="On-time" value={`${staff.onTime}%`} />
                  <Stat label="Load" value={`${staff.openLoad}/${staff.capacity}`} />
                </div>
                <button className="mt-3 w-full rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">Reassign</button>
              </>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">Unassigned.</p>
                <button className="mt-2 w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Assign staff</button>
              </div>
            )}
          </Card>

          <Card icon="ph-info" title="Order facts">
            <div className="space-y-1.5 text-sm">
              <Fact label="Order #" value={`#${seq}`} />
              <Fact label="Created" value={order.created} />
              <Fact label="Deadline" value={<span className={overdue ? 'font-semibold text-amber-500' : ''}>{order.deadline ?? '—'}{overdue ? ' · overdue' : ''}</span>} />
              <Fact label="Priority" value={order.priority} />
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>
      {children}
    </div>
  );
}
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="shrink-0 text-muted-foreground">{label}</span><span className="truncate text-right font-medium">{value}</span></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-background/40 p-2"><p className="display text-base font-bold capitalize leading-none">{value}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p></div>;
}
function Msg({ who, body, internal }: { who: string; body: string; internal?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 ${internal ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-border bg-background/40'}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold">{who}{internal && <span className="pill pill-warn">internal</span>}</p>
      <p className="text-sm">{body}</p>
    </div>
  );
}
