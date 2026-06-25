'use client';

import { Fragment, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { statusLabel, money, TIER, type OrderStatus, type Priority } from '@/data/adminMock';
import { Checklist } from './Checklist';

interface StaffLite { name: string; composite: number; quality: number; onTime: number; openLoad: number; capacity: number; skills: string[] }
interface CustLite { id: string; name: string; email: string; status: string; tier: keyof typeof TIER; spend: number; orders: number; balance: number }
interface OrderLite { id: string; seq: number; code: string; customer: string; service: string; pkg: string; status: OrderStatus; priority: Priority; source: string; value: number; staff: string | null; deadline: string | null; created: string }
interface Activity { id: string; at: string; action: string; change: string }

interface Props {
  order: OrderLite; cust?: CustLite; site: string; today: string; project: string; folder: string;
  included: string[]; brief: { label: string; value: string }[];
  addons: { name: string; tier: string; price: number }[]; addonsTotal: number;
  bundle: { id: string; code: string; service: string; pkg: string; customer: string; value: number; status: OrderStatus }[];
  eligibleStaff: StaffLite[]; initialActivity: Activity[];
  prev?: { id: string; code: string }; next?: { id: string; code: string };
}

// 6 named stages; each order status maps to one stage.
const FLOW: { label: string }[] = [
  { label: 'New' }, { label: 'Confirmed' }, { label: 'In progress' }, { label: 'Review' }, { label: 'Delivered' }, { label: 'Done' },
];
const STAGE_OF: Record<OrderStatus, number> = {
  new: 0, confirmed: 1, assigned: 2, in_progress: 2, changes_requested: 2,
  internal_review: 3, delivered: 4, approved: 5, completed: 5, canceled: -1,
};

type Act = { label: string; to: OrderStatus; primary?: boolean; danger?: boolean; assign?: boolean; note?: boolean };
const NEXT: Record<OrderStatus, Act[]> = {
  new: [{ label: 'Confirm', to: 'confirmed', primary: true }, { label: 'Cancel', to: 'canceled', danger: true }],
  confirmed: [{ label: 'Assign staff', to: 'assigned', primary: true, assign: true }, { label: 'Cancel', to: 'canceled', danger: true }],
  assigned: [{ label: 'Start work', to: 'in_progress', primary: true }],
  in_progress: [{ label: 'Send to review', to: 'internal_review', primary: true }],
  internal_review: [{ label: 'Deliver', to: 'delivered', primary: true }, { label: 'Kick back', to: 'in_progress' }],
  delivered: [{ label: 'Approve', to: 'approved', primary: true }, { label: 'Request changes', to: 'changes_requested', note: true }],
  changes_requested: [{ label: 'Resume work', to: 'in_progress', primary: true }],
  approved: [{ label: 'Mark completed', to: 'completed', primary: true }],
  completed: [], canceled: [],
};

const PRI_ACTIVE: Record<Priority, string> = {
  low: 'bg-muted text-foreground',
  med: 'bg-amber-500 text-white',
  high: 'bg-destructive text-white',
};

export function OrderDetailClient(p: Props) {
  const [status, setStatus] = useState<OrderStatus>(p.order.status);
  const [staff, setStaff] = useState<string | null>(p.order.staff);
  const [priority, setPriority] = useState<Priority>(p.order.priority);
  const [deadline, setDeadline] = useState<string>(p.order.deadline ?? '');
  const [balance, setBalance] = useState<number>(p.cust?.balance ?? 0);
  const [debited, setDebited] = useState<boolean>(!['new', 'canceled'].includes(p.order.status));
  const [activity, setActivity] = useState<Activity[]>(p.initialActivity);
  const [messages, setMessages] = useState<{ who: string; body: string; internal: boolean }[]>([
    { who: 'You', body: 'Confirmed scope with the client; prioritise the money pages.', internal: true },
    { who: p.cust?.name ?? p.order.customer, body: 'Looking forward to the first draft — thanks!', internal: false },
  ]);

  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; onYes: () => void } | null>(null);
  const [picker, setPicker] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [msgInternal, setMsgInternal] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmt, setRefundAmt] = useState(String(p.order.value));
  const [staffNotes, setStaffNotes] = useState<{ body: string; at: string }[]>([{ body: "Use the client's brand voice; avoid mentioning competitors by name.", at: `${p.today} 09:00` }]);
  const [staffNote, setStaffNote] = useState('');

  const o = p.order;
  const nowStamp = `${p.today} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  function notify(m: string) { setToast(m); setTimeout(() => setToast(null), 2600); }
  function log(action: string, change: string) { setActivity((a) => [{ id: `${Date.now()}`, at: nowStamp, action, change }, ...a]); }

  function transition(to: OrderStatus, extra?: string) {
    const from = status;
    setStatus(to);
    log('transition', `${o.code} ${from}→${to}${extra ? ` (${extra})` : ''}`);
    if (to === 'confirmed' && !debited) { setDebited(true); setBalance((b) => b - o.value); notify(`Confirmed · ${money(o.value)} credit debited`); }
    else if (to === 'canceled') { if (debited) { setBalance((b) => b + o.value); } notify('Order canceled' + (debited ? ` · ${money(o.value)} refunded` : '')); }
    else notify(`Moved to ${statusLabel[to]}`);
  }
  function act(a: Act) {
    if (a.assign) { setPicker(true); return; }
    if (a.note) { setNoteOpen(true); return; }
    if (a.danger) { setConfirm({ title: `${a.label} this order?`, body: a.to === 'canceled' && debited ? `Credit of ${money(o.value)} will be refunded.` : 'This cannot be undone.', onYes: () => { transition(a.to); setConfirm(null); } }); return; }
    transition(a.to);
  }
  function assignTo(name: string) { setStaff(name); setPicker(false); if (status === 'confirmed') transition('assigned', `→ ${name}`); else { log('assign', `${o.code} → ${name}`); notify(`Assigned to ${name}`); } }
  function sendMsg() { if (!msg.trim()) return; setMessages((m) => [...m, { who: 'You', body: msg.trim(), internal: msgInternal }]); setMsg(''); notify(msgInternal ? 'Internal note added' : 'Message sent to customer'); }
  function sendStaffNote() { if (!staffNote.trim()) return; setStaffNotes((n) => [...n, { body: staffNote.trim(), at: nowStamp }]); setStaffNote(''); log('note', `${o.code} note to staff`); notify(`Note sent to ${staff ?? 'staff (unassigned)'}`); }
  function doRefund() { const amt = Math.max(0, Number(refundAmt) || 0); setBalance((b) => b + amt); log('refund', `${o.code} refund ${money(amt)}`); notify(`Refunded ${money(amt)}`); setRefundOpen(false); }

  const actions = NEXT[status] ?? [];
  const primary = actions.find((a) => a.primary);
  const others = actions.filter((a) => !a.primary);
  const overdue = !!deadline && deadline < p.today && !['completed', 'canceled'].includes(status);
  const dToDue = deadline ? Math.round((new Date(deadline).getTime() - new Date(p.today).getTime()) / 86400000) : null;
  const ageDays = Math.round((new Date(p.today).getTime() - new Date(o.created).getTime()) / 86400000);
  const banner = makeBanner(status, staff, dToDue, overdue);
  const submitted = ['delivered', 'approved', 'completed', 'changes_requested'].includes(status);

  return (
    <section>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* compact header card */}
          <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href="/admin/orders" className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent" title="Back to orders"><i className="ph-bold ph-arrow-left" /></Link>
            <span className="display text-xl font-bold tracking-tight">{o.code}</span>
            <span className="text-xs font-semibold text-muted-foreground">#{o.seq}</span>
            <PriorityBadge priority={priority} /><StatusBadge status={status} />
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${banner.cls}`}><i className={`ph-bold ${banner.icon}`} /> {banner.text}</span>
        </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                {p.prev ? <Link href={`/admin/orders/${p.prev.id}`} className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-accent" title={`Prev · ${p.prev.code}`}><i className="ph-bold ph-caret-left" /></Link> : <span className="grid h-7 w-7 place-items-center rounded-lg border border-border/50 text-muted-foreground/40"><i className="ph-bold ph-caret-left" /></span>}
                {p.next ? <Link href={`/admin/orders/${p.next.id}`} className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-accent" title={`Next · ${p.next.code}`}><i className="ph-bold ph-caret-right" /></Link> : <span className="grid h-7 w-7 place-items-center rounded-lg border border-border/50 text-muted-foreground/40"><i className="ph-bold ph-caret-right" /></span>}
              </div>
              {primary && <button onClick={() => act(primary)} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">{primary.label}</button>}
              {others.map((a) => <button key={a.label} onClick={() => act(a)} className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition hover:bg-accent ${a.danger ? 'border-destructive/40 text-destructive' : 'border-border'}`}>{a.label}</button>)}
              <MoreMenu onAssign={() => setPicker(true)} onRefund={() => setRefundOpen(true)}
                onCancel={() => setConfirm({ title: 'Cancel this order?', body: debited ? `Credit of ${money(o.value)} will be refunded.` : 'This cannot be undone.', onYes: () => { transition('canceled'); setConfirm(null); } })}
                canCancel={!['completed', 'canceled'].includes(status)} />
            </div>
            <div className="min-w-0 flex-1 basis-72"><ProgressTracker status={status} /></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{o.service} · {o.pkg} · {money(o.value)} · {p.cust?.name ?? o.customer} · {ageDays}d ago</p>
          </div>

          <Card icon="ph-package" title="Scope">
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Field label="Project" value={`${o.customer} — SEO program`} />
              <Field label="Service" value={`${o.service} · ${o.pkg}`} />
              <Field label="Site" value={p.site} />
              <Field label="Target URL" value={<a href={`https://${p.site}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://{p.site}</a>} />
              <Field label="Priority" value={
                <div className="inline-flex rounded-lg border border-border p-0.5">
                  {(['low', 'med', 'high'] as Priority[]).map((pr) => (
                    <button key={pr} type="button" onClick={() => { if (pr === priority) return; setPriority(pr); log('edit', `${o.code} priority → ${pr}`); notify(`Priority → ${pr}`); }}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide transition ${priority === pr ? PRI_ACTIVE[pr] : 'text-muted-foreground hover:text-foreground'}`}>
                      {pr}
                    </button>
                  ))}
                </div>
              } />
              <Field label="Deadline" value={<input type="date" value={deadline} onChange={(e) => { setDeadline(e.target.value); log('edit', `${o.code} deadline → ${e.target.value}`); notify('Deadline updated'); }} className={`rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary ${overdue ? 'border-amber-500 text-amber-500' : 'border-border'}`} />} />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Package · {money(o.value)}</p>
              <p className="mt-0.5 text-sm font-semibold">{o.service} · {o.pkg}</p>
              <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">{p.included.map((x) => <li key={x} className="flex gap-2"><i className="ph-fill ph-check-circle mt-0.5 shrink-0 text-primary" />{x}</li>)}</ul>
            </div>
          </Card>

          <Card icon="ph-note-pencil" title="Customer intake — full submission">
            <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border bg-background/40 px-3 py-2 text-sm">
              <i className="ph-bold ph-folders text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filed under</span>
              <span className="font-semibold">{p.project}</span>
              <i className="ph-bold ph-caret-right text-xs text-muted-foreground" />
              <span className="inline-flex items-center gap-1 font-semibold"><i className="ph-bold ph-folder text-muted-foreground" />{p.folder}</span>
            </div>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{p.brief.map((f) => <Field key={f.label} label={f.label} value={f.value} />)}</div>
            {p.addons.length > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600"><i className="ph-bold ph-plus-circle" /> Upsells added at checkout</p>
                <div className="space-y-1 text-sm">
                  {p.addons.map((a) => <div key={a.name} className="flex justify-between"><span>{a.name} <span className="text-muted-foreground">· {a.tier}</span></span><span className="font-semibold">+{money(a.price)}</span></div>)}
                  <div className="mt-1 flex justify-between border-t border-emerald-500/20 pt-1 font-semibold"><span>Upsell total</span><span>{money(p.addonsTotal)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Order grand total</span><span className="font-semibold text-foreground">{money(o.value + p.addonsTotal)}</span></div>
                </div>
              </div>
            )}
          </Card>

          {p.bundle.length > 0 && (
            <Card icon="ph-link" title="Related orders (bundled upsells)">
              <p className="mb-2 text-xs text-muted-foreground">Placed together with this order at checkout.</p>
              <div className="space-y-2">{p.bundle.map((b) => <Link key={b.id} href={`/admin/orders/${b.id}`} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3 transition hover:border-primary/50"><div className="min-w-0"><p className="truncate text-sm font-medium">{b.code} · {b.service} · {b.pkg}</p><p className="text-[11px] text-muted-foreground">{b.customer}</p></div><div className="flex shrink-0 items-center gap-2"><StatusBadge status={b.status} /><span className="text-sm font-semibold">{money(b.value)}</span></div></Link>)}</div>
            </Card>
          )}

          <Card icon="ph-wrench" title="Fulfillment">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Assigned staff</p>
                {staff ? (
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="font-semibold">{staff}</p>
                    <button onClick={() => setPicker(true)} className="mt-2 w-full rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">Reassign</button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-3"><p className="text-sm text-muted-foreground">Unassigned</p><button onClick={() => setPicker(true)} className="mt-2 w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Assign staff</button></div>
                )}
              </div>
              <Checklist service={o.service} />
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-bold ph-note text-primary" /> Notes to staff {staff ? <span className="text-foreground">· {staff}</span> : <span>· unassigned</span>}</p>
              <div className="space-y-1.5">
                {staffNotes.map((n, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-2 text-sm">
                    <p className="flex items-center justify-between text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">Admin</span><span>{n.at}</span></p>
                    <p>{n.body}</p>
                  </div>
                ))}
                {staffNotes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input value={staffNote} onChange={(e) => setStaffNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendStaffNote()} placeholder={`Note an instruction for ${staff ?? 'the staff'}…`} className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary" />
                <button onClick={sendStaffNote} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Send</button>
              </div>
            </div>

            <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">Deliverables</p>
            {submitted ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center gap-3"><i className="ph-bold ph-file-text text-2xl text-primary" /><div><p className="text-sm font-medium">{o.code}-report-v1.pdf</p><p className="text-[11px] text-muted-foreground">submitted by {staff ?? '—'}</p></div></div>
                {status === 'delivered' && <div className="flex gap-2"><button onClick={() => transition('approved')} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Approve</button><button onClick={() => setNoteOpen(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Request changes</button></div>}
              </div>
            ) : <p className="text-sm text-muted-foreground">Awaiting submission from staff.</p>}
          </Card>

          <Card icon="ph-chats-circle" title="Messages">
            <div className="space-y-2">{messages.map((m, i) => <Msg key={i} who={m.who} body={m.body} internal={m.internal} />)}</div>
            <div className="mt-3 flex items-center gap-2">
              <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMsg()} placeholder="Write a message…" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={msgInternal} onChange={(e) => setMsgInternal(e.target.checked)} className="accent-primary" /> internal</label>
              <button onClick={sendMsg} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Send</button>
            </div>
          </Card>

          <Card icon="ph-scroll" title="Activity">
            <ul className="space-y-1.5 text-xs text-muted-foreground">{activity.map((a) => <li key={a.id}><span className="text-foreground">{a.at}</span> — {a.action}: {a.change}</li>)}</ul>
          </Card>
        </div>

        {/* sidebar */}
        <div className="space-y-4">
          <Card icon="ph-user" title="Customer">
            <div className="flex items-center gap-2"><span className="font-semibold">{p.cust?.name ?? o.customer}</span>{p.cust && <span className="inline-flex items-center gap-1" title={`${TIER[p.cust.tier].label} customer`}><i className={`ph-fill ${TIER[p.cust.tier].icon}`} style={{ color: TIER[p.cust.tier].color }} /><span className="text-[10px] font-semibold" style={{ color: TIER[p.cust.tier].color }}>{TIER[p.cust.tier].label}</span></span>}</div>
            <p className="text-xs text-muted-foreground">{o.customer}{p.cust ? ` · ${p.cust.email}` : ''}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><Stat label="Lifetime value" value={money(p.cust?.spend ?? o.value)} /><Stat label="Total orders" value={String(p.cust?.orders ?? 1)} /><Stat label="Credit" value={money(balance)} /><Stat label="Status" value={p.cust?.status ?? 'shadow'} /></div>
            {p.cust && <Link href={`/admin/customers/${p.cust.id}`} className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">Customer profile →</Link>}
          </Card>

          <Card icon="ph-wallet" title="Commercial">
            <div className="space-y-1.5 text-sm">
              <Fact label="Order value" value={<span className="font-semibold">{money(o.value)}</span>} />
              <Fact label="Credit debit" value={debited ? <span>−{money(o.value)}</span> : <span className="text-muted-foreground">on confirm</span>} />
              <Fact label="Credit balance" value={money(balance)} />
              <Fact label="Payment" value={status === 'completed' ? 'Settled' : 'Pending'} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { setBalance((b) => b + 50); log('credit', `${o.code} +$50 goodwill`); notify('Added $50 credit'); }} className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">Adjust +$50</button>
              <button onClick={() => setRefundOpen(true)} className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">Refund</button>
            </div>
          </Card>

          <Card icon="ph-info" title="Order facts">
            <div className="space-y-1.5 text-sm"><Fact label="Order #" value={`#${o.seq}`} /><Fact label="Created" value={o.created} /><Fact label="Source" value={o.source} /><Fact label="Age" value={`${ageDays}d`} /></div>
          </Card>
        </div>
      </div>

      {/* overlays */}
      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl"><i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" />{toast}</div>}

      {picker && (
        <Overlay onClose={() => setPicker(false)} title="Assign staff">
          <p className="mb-3 text-xs text-muted-foreground">Suggested for <b className="text-foreground">{o.service}</b> · ranked by score & availability.</p>
          <div className="space-y-2">{p.eligibleStaff.map((s) => (
            <button key={s.name} onClick={() => assignTo(s.name)} className="flex w-full items-center justify-between rounded-xl border border-border bg-background/40 p-3 text-left transition hover:border-primary/50">
              <div><p className="font-semibold">{s.name}</p><p className="text-[11px] text-muted-foreground">{s.quality}% quality · {s.onTime}% on-time · {s.openLoad}/{s.capacity} load · {s.skills.join(', ')}</p></div>
              <span className="display text-lg font-bold text-primary">{s.composite}</span>
            </button>
          ))}</div>
        </Overlay>
      )}

      {noteOpen && (
        <Overlay onClose={() => setNoteOpen(false)} title="Request changes">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="What needs changing?" className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary" />
          <button onClick={() => { transition('changes_requested', note.trim() || 'changes'); setNote(''); setNoteOpen(false); }} className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">Send back to staff</button>
        </Overlay>
      )}

      {refundOpen && (
        <Overlay onClose={() => setRefundOpen(false)} title="Refund credit">
          <label className="text-xs text-muted-foreground">Amount</label>
          <input type="number" value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <p className="mt-2 text-xs text-muted-foreground">Balance: {money(balance)} → <b className="text-foreground">{money(balance + (Number(refundAmt) || 0))}</b></p>
          <button onClick={doRefund} className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">Confirm refund</button>
        </Overlay>
      )}

      {confirm && (
        <Overlay onClose={() => setConfirm(null)} title={confirm.title}>
          <p className="text-sm text-muted-foreground">{confirm.body}</p>
          <div className="mt-4 flex gap-2"><button onClick={() => setConfirm(null)} className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold">Keep</button><button onClick={confirm.onYes} className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white">Confirm</button></div>
        </Overlay>
      )}
    </section>
  );
}

function makeBanner(status: OrderStatus, staff: string | null, dToDue: number | null, overdue: boolean) {
  const due = dToDue == null ? '' : overdue ? `overdue by ${-dToDue}d` : `due in ${dToDue}d`;
  switch (status) {
    case 'new': return { text: 'Awaiting your confirmation', icon: 'ph-bell-ringing', cls: 'border-amber-500/30 bg-amber-500/[0.08] text-amber-600' };
    case 'confirmed': return { text: 'Confirmed — ready to assign a staff', icon: 'ph-user-plus', cls: 'border-primary/30 bg-primary/[0.06] text-primary' };
    case 'assigned': case 'in_progress': case 'internal_review':
      return overdue
        ? { text: `${overdue ? 'Overdue' : ''} — with ${staff ?? 'staff'} · ${due} · nudge`, icon: 'ph-warning', cls: 'border-destructive/30 bg-destructive/[0.08] text-destructive' }
        : { text: `With ${staff ?? 'staff'} · ${due}`, icon: 'ph-clock', cls: 'border-primary/30 bg-primary/[0.06] text-primary' };
    case 'changes_requested': return { text: 'Changes requested — back with staff', icon: 'ph-arrow-counter-clockwise', cls: 'border-amber-500/30 bg-amber-500/[0.08] text-amber-600' };
    case 'delivered': return { text: 'Delivered — needs your review', icon: 'ph-seal-check', cls: 'border-amber-500/30 bg-amber-500/[0.08] text-amber-600' };
    case 'approved': return { text: 'Approved — ready to complete', icon: 'ph-check-circle', cls: 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600' };
    case 'completed': return { text: 'Completed', icon: 'ph-check-circle', cls: 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600' };
    case 'canceled': return { text: 'Canceled', icon: 'ph-x-circle', cls: 'border-border bg-muted text-muted-foreground' };
  }
}

function MoreMenu({ onAssign, onRefund, onCancel, canCancel }: { onAssign: () => void; onRefund: () => void; onCancel: () => void; canCancel: boolean }) {
  const [open, setOpen] = useState(false);
  const items = [
    { icon: 'ph-user-gear', label: 'Assign / reassign', fn: onAssign, danger: false },
    { icon: 'ph-arrow-u-down-left', label: 'Refund', fn: onRefund, danger: false },
    ...(canCancel ? [{ icon: 'ph-x-circle', label: 'Cancel order', fn: onCancel, danger: true }] : []),
  ];
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-lg border border-border transition hover:bg-accent" aria-label="More actions"><i className="ph-bold ph-dots-three-outline" /></button>
      {open && (<><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} /><div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">{items.map((i) => <button key={i.label} onClick={() => { i.fn(); setOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition hover:bg-muted ${i.danger ? 'text-destructive' : ''}`}><i className={`ph-bold ${i.icon} ${i.danger ? '' : 'text-muted-foreground'}`} /> {i.label}</button>)}</div></>)}
    </div>
  );
}

function ProgressTracker({ status }: { status: OrderStatus }) {
  if (status === 'canceled') return <span className="pill pill-warn"><i className="ph-bold ph-x-circle" /> Order canceled</span>;
  const idx = STAGE_OF[status];
  const changes = status === 'changes_requested';
  return (
    <div className="flex items-start">
      {FLOW.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 && <span className={`mx-1.5 mt-3 h-0.5 flex-1 ${i <= idx ? 'bg-primary' : 'bg-border'}`} />}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${i < idx ? 'bg-primary text-primary-foreground' : i === idx ? 'border-2 border-primary text-primary' : 'border border-border text-muted-foreground'}`}>{i < idx ? <i className="ph-bold ph-check" /> : i + 1}</span>
            <span className={`whitespace-nowrap text-[10px] ${i === idx ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{s.label}{changes && i === idx ? ' ·changes' : ''}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function Overlay({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="order-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-in relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><p className="display text-base font-bold">{title}</p><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-x" /></button></div>
        {children}
      </div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{children}</div>;
}
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="shrink-0 text-muted-foreground">{label}</span><span className="truncate text-right font-medium">{value}</span></div>;
}
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-background/40 p-2"><p className="display text-base font-bold capitalize leading-none">{value}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p></div>;
}
function Msg({ who, body, internal }: { who: string; body: string; internal: boolean }) {
  return <div className={`rounded-xl border p-2.5 ${internal ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-border bg-background/40'}`}><p className="flex items-center gap-1.5 text-[11px] font-semibold">{who}{internal && <span className="pill pill-warn">internal</span>}</p><p className="text-sm">{body}</p></div>;
}
