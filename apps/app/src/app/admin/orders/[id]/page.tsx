import { Fragment, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { ORDERS, AUDIT, STAFF, TIER, ORDER_EXTRA, SERVICE_INCLUDED, customerByCompany, money, type OrderStatus, type AdminOrder } from '@/data/adminMock';
import { OrderActions } from './OrderActions';
import { SeoOutcomes } from './SeoOutcomes';
import { Checklist } from './Checklist';

const seqMap = new Map([...ORDERS].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const));

const FLOW: { key: OrderStatus; label: string }[] = [
  { key: 'new', label: 'New' }, { key: 'confirmed', label: 'Confirmed' }, { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' }, { key: 'internal_review', label: 'Review' },
  { key: 'delivered', label: 'Delivered' }, { key: 'approved', label: 'Approved' }, { key: 'completed', label: 'Completed' },
];

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = ORDERS.find((o) => o.id === id);
  if (!order) notFound();

  const seq = seqMap.get(order.id) ?? 0;
  const cust = customerByCompany(order.customer);
  const staff = STAFF.find((s) => s.name === order.staff);
  const site = cust?.email.split('@')[1] ?? `${order.customer.toLowerCase().replace(/\s+/g, '')}.com`;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = order.deadline && order.deadline < today && order.status !== 'completed' && order.status !== 'canceled';
  const debited = !['new', 'canceled'].includes(order.status);
  const submitted = ['delivered', 'approved', 'completed', 'changes_requested'].includes(order.status);
  const timeline = AUDIT.filter((a) => a.change.startsWith(order.code));

  const extra = ORDER_EXTRA[order.id];
  const included = extra?.included ?? SERVICE_INCLUDED[order.service] ?? [];
  const brief = extra?.brief ?? [{ label: 'Website', value: `https://${site}` }, { label: 'Goal', value: 'Improve organic visibility' }, { label: 'Market', value: 'US · English' }];
  const addons = extra?.addons ?? [];
  const addonsTotal = addons.reduce((s, a) => s + a.price, 0);
  const bundle = (extra?.bundle ?? []).map((bid) => ORDERS.find((o) => o.id === bid)).filter((o): o is AdminOrder => !!o);

  return (
    <section className="space-y-5">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><i className="ph-bold ph-arrow-left" /> Orders</Link>

      {/* sticky header */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:-mx-7 lg:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="display text-2xl font-bold tracking-tight">{order.code}</span>
              <span className="text-sm font-semibold text-muted-foreground">#{seq}</span>
              <PriorityBadge priority={order.priority} /><StatusBadge status={order.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{order.service} · {order.pkg} · {money(order.value)} · {cust?.name ?? order.customer}</p>
          </div>
          <OrderActions status={order.status} />
        </div>
        <div className="mt-3"><ProgressTracker status={order.status} /></div>
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
              <Fact label="Deadline" value={<span className={overdue ? 'font-semibold text-amber-500' : ''}>{order.deadline ?? '—'}{overdue ? ' · overdue' : ''}</span>} />
              <Fact label="Priority" value={<span className="capitalize">{order.priority}</span>} />
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">Package · {money(order.value)}</p>
                <p className="text-sm font-semibold">{order.service} · {order.pkg}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {included.map((x) => <li key={x} className="flex gap-2"><i className="ph-fill ph-check-circle mt-0.5 shrink-0 text-primary" />{x}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">Customer inputs</p>
                <div className="mt-2 space-y-1.5 text-sm">
                  {brief.map((f) => <div key={f.label}><span className="text-muted-foreground">{f.label}: </span><span className="font-medium">{f.value}</span></div>)}
                </div>
              </div>
            </div>

            {addons.length > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600"><i className="ph-bold ph-plus-circle" /> Upsells added at checkout</p>
                <div className="space-y-1 text-sm">
                  {addons.map((a) => <div key={a.name} className="flex justify-between"><span>{a.name} <span className="text-muted-foreground">· {a.tier}</span></span><span className="font-semibold">+{money(a.price)}</span></div>)}
                  <div className="mt-1 flex justify-between border-t border-emerald-500/20 pt-1 font-semibold"><span>Upsell total</span><span>{money(addonsTotal)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Order grand total</span><span className="font-semibold text-foreground">{money(order.value + addonsTotal)}</span></div>
                </div>
              </div>
            )}
          </Card>

          {bundle.length > 0 && (
            <Card icon="ph-link" title="Related orders (bundled upsells)">
              <p className="mb-2 text-xs text-muted-foreground">Placed together with this order at checkout.</p>
              <div className="space-y-2">
                {bundle.map((b) => (
                  <Link key={b.id} href={`/admin/orders/${b.id}`} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3 transition hover:border-primary/50">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{b.code} · {b.service} · {b.pkg}</p><p className="text-[11px] text-muted-foreground">{b.customer}</p></div>
                    <div className="flex shrink-0 items-center gap-2"><StatusBadge status={b.status} /><span className="text-sm font-semibold">{money(b.value)}</span></div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <SeoOutcomes order={order} />

          <Card icon="ph-wrench" title="Fulfillment">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Assigned staff</p>
                {staff ? (
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between"><span className="font-semibold">{staff.name}</span><span className="display text-lg font-bold text-primary">{staff.composite}</span></div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{staff.throughput} done · {staff.quality}% quality · {staff.onTime}% on-time · {staff.openLoad}/{staff.capacity} load</p>
                    <button className="mt-2 w-full rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">Reassign</button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-3">
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                    <button className="mt-2 w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Assign staff</button>
                  </div>
                )}
              </div>
              <Checklist service={order.service} />
            </div>

            <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">Deliverables</p>
            {submitted ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center gap-3"><i className="ph-bold ph-file-text text-2xl text-primary" /><div><p className="text-sm font-medium">{order.code}-report-v1.pdf</p><p className="text-[11px] text-muted-foreground">submitted by {order.staff ?? '—'}</p></div></div>
                {order.status === 'delivered' && <div className="flex gap-2"><button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Approve</button><button className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Request changes</button></div>}
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
              <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" className="accent-primary" /> internal</label>
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

          <Card icon="ph-wallet" title="Commercial">
            <div className="space-y-1.5 text-sm">
              <Fact label="Order value" value={<span className="font-semibold">{money(order.value)}</span>} />
              <Fact label="Credit debit" value={debited ? <span className="text-foreground">−{money(order.value)}</span> : <span className="text-muted-foreground">on confirm</span>} />
              <Fact label="Invoice" value={debited ? 'Issued' : 'Draft'} />
              <Fact label="Payment" value={order.status === 'completed' ? 'Settled' : 'Pending'} />
            </div>
            <div className="mt-3 flex gap-2">
              <button className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">Adjust credit</button>
              <button className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">Refund</button>
            </div>
          </Card>

          <Card icon="ph-info" title="Order facts">
            <div className="space-y-1.5 text-sm">
              <Fact label="Order #" value={`#${seq}`} />
              <Fact label="Created" value={order.created} />
              <Fact label="Source" value={order.source} />
              <Fact label="Deadline" value={order.deadline ?? '—'} />
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function ProgressTracker({ status }: { status: OrderStatus }) {
  if (status === 'canceled') return <span className="pill pill-warn"><i className="ph-bold ph-x-circle" /> Order canceled</span>;
  const changes = status === 'changes_requested';
  const idx = changes ? FLOW.findIndex((s) => s.key === 'in_progress') : FLOW.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {FLOW.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 && <span className={`h-0.5 w-4 shrink-0 sm:w-8 ${i <= idx ? 'bg-primary' : 'bg-border'}`} />}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${i < idx ? 'bg-primary text-primary-foreground' : i === idx ? 'border-2 border-primary text-primary' : 'border border-border text-muted-foreground'}`}>
              {i < idx ? <i className="ph-bold ph-check" /> : i + 1}
            </span>
            <span className={`whitespace-nowrap text-[10px] ${i === idx ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
          </div>
        </Fragment>
      ))}
      {changes && <span className="pill pill-warn ml-2 shrink-0">changes requested</span>}
    </div>
  );
}

function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{children}</div>;
}
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="shrink-0 text-muted-foreground">{label}</span><span className="truncate text-right font-medium">{value}</span></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-background/40 p-2"><p className="display text-base font-bold capitalize leading-none">{value}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p></div>;
}
function Msg({ who, body, internal }: { who: string; body: string; internal?: boolean }) {
  return <div className={`rounded-xl border p-2.5 ${internal ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-border bg-background/40'}`}><p className="flex items-center gap-1.5 text-[11px] font-semibold">{who}{internal && <span className="pill pill-warn">internal</span>}</p><p className="text-sm">{body}</p></div>;
}
