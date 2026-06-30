'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { broadcastStats, useBroadcastActivity, newBroadcastId, nowIso } from '@/data/broadcastStore';
import { messageReadCount } from '@/lib/broadcastAnalytics';
import { saveBroadcastAction, setBroadcastActiveAction, deleteBroadcastAction } from '@/app/admin/broadcasts/broadcast.actions';
import { BroadcastComposer } from './BroadcastComposer';
import { KIND_META, AUDIENCE_META, isLive, isScheduled, type Broadcast } from '@/data/broadcasts';
import { ago } from '@/lib/relativeTime';

function statusOf(b: Broadcast): { label: string; cls: string } {
  if (!b.active) return { label: 'Recalled', cls: 'pill-warn' };
  if (isScheduled(b)) return { label: 'Scheduled', cls: '' };
  if (b.expiresAt && new Date(b.expiresAt).getTime() < Date.now()) return { label: 'Expired', cls: '' };
  return { label: 'Live', cls: 'pill-live' };
}

// Admin control room for broadcasts: compose, see who each message went to / how it's shown / who
// read it, edit, duplicate, recall/restore, or delete. Recall stops delivery without deleting.
// Lane C inc-C5 — `broadcasts` is the real admin list (getBroadcasts). Compose/edit/recall/delete go
// through the admin-gated DB fns; analytics columns (read counts) are still mock until inc-C6.
export function BroadcastsManager({ broadcasts }: { broadcasts: Broadcast[] }) {
  const router = useRouter();
  const all = broadcasts;
  const activity = useBroadcastActivity();
  const [composer, setComposer] = useState<{ open: boolean; editing: Broadcast | null }>({ open: false, editing: null });
  const [confirm, setConfirm] = useState<{ id: string; title: string } | null>(null);
  const [query, setQuery] = useState('');
  const [err, setErr] = useState('');

  const live = useMemo(() => all.filter((b) => isLive(b)).length, [all]);
  const banners = useMemo(() => all.filter((b) => isLive(b) && b.banner).length, [all]);
  const recalled = useMemo(() => all.filter((b) => !b.active).length, [all]);

  const q = query.trim().toLowerCase();
  const rows = q ? all.filter((b) => `${b.title} ${b.body}`.toLowerCase().includes(q)) : all;

  const openNew = () => setComposer({ open: true, editing: null });
  const openEdit = (b: Broadcast) => setComposer({ open: true, editing: b });
  const onSave = async (b: Broadcast) => {
    const res = await saveBroadcastAction(b);
    if (!res.ok) { setErr(res.error); return; }
    setComposer({ open: false, editing: null }); setErr(''); router.refresh();
  };
  const duplicate = async (b: Broadcast) => {
    const res = await saveBroadcastAction({ ...b, id: newBroadcastId(), title: `${b.title} (copy)`, createdAt: nowIso(), updatedAt: undefined, publishAt: null, active: true });
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  };
  const setActive = async (id: string, active: boolean) => {
    const res = await setBroadcastActiveAction(id, active);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  };
  const removeBroadcast = async (id: string) => {
    const res = await deleteBroadcastAction(id);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Broadcasts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Send notices, announcements &amp; alerts to customers, staff, managers or affiliates.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages…" className="w-48 rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-primary sm:w-56" />
          </div>
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-plus" aria-hidden /> New message</button>
        </div>
      </div>

      {err && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{err}</p>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi icon="ph-megaphone" label="Total" value={String(all.length)} />
        <Kpi icon="ph-broadcast" label="Live" value={String(live)} tone="good" />
        <Kpi icon="ph-flag-banner" label="With banner" value={String(banners)} />
        <Kpi icon="ph-arrow-u-up-left" label="Recalled" value={String(recalled)} tone={recalled ? 'warn' : undefined} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Message</th><th className="p-3">Type</th><th className="p-3">Audiences</th><th className="p-3">Shown</th><th className="p-3">Status</th><th className="p-3">Sent</th><th className="w-px p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const m = KIND_META[b.kind];
              const st = statusOf(b);
              const stats = broadcastStats(b);
              const rc = messageReadCount(b);
              return (
                <tr key={b.id} className="border-b border-border/50 align-top transition hover:bg-muted/40">
                  <td className="p-3">
                    <Link href={`/admin/broadcasts/${b.id}`} className="text-left font-semibold hover:text-primary hover:underline">{b.title}</Link>
                    {b.pinned && <i className="ph-fill ph-push-pin ml-1.5 text-amber-500" title="Pinned" aria-hidden />}
                    {b.requireAck && <i className="ph-bold ph-seal-check ml-1.5 text-amber-600" title="Requires acknowledgement" aria-hidden />}
                    <p className="line-clamp-1 max-w-md text-[11px] text-muted-foreground">{b.body}</p>
                  </td>
                  <td className="p-3"><span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: `${m.color}1a`, color: m.color }}><i className={`ph-fill ${m.icon}`} aria-hidden />{m.label}</span></td>
                  <td className="p-3"><span className="flex flex-wrap gap-1">{stats.map((s) => { const am = AUDIENCE_META[s.audience]; return <span key={s.audience} title={s.acked ? 'Acknowledged' : s.read ? 'Read' : 'Not read yet'} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${s.read ? '' : 'opacity-50'}`} style={{ background: `${am.color}1a`, color: am.color }}><i className={`ph-fill ${s.acked ? 'ph-seal-check' : s.read ? 'ph-check-circle' : am.icon}`} aria-hidden />{am.label}</span>; })}</span></td>
                  <td className="p-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ph-bold ph-bell" title="Inbox + bell" aria-hidden />
                      {b.banner && <i className="ph-bold ph-flag-banner text-primary" title="Overview banner" aria-hidden />}
                      {b.cta && <i className="ph-bold ph-link-simple" title={`CTA: ${b.cta.label}`} aria-hidden />}
                    </span>
                    <Link href={`/admin/broadcasts/${b.id}`} className="mt-1 block text-[10px] hover:text-primary hover:underline">{rc.read}/{rc.total} read{rc.clicks > 0 && ` · ${rc.clicks} clicks`}</Link>
                  </td>
                  <td className="p-3"><span className={`pill ${st.cls}`} title={b.publishAt ? `Publish ${new Date(b.publishAt).toLocaleString()}` : undefined}>{st.label}</span></td>
                  <td className="p-3 text-muted-foreground">{ago(b.createdAt)}{b.updatedAt && <span className="block text-[10px] opacity-70" title={`Edited ${new Date(b.updatedAt).toLocaleString()}`}>edited {ago(b.updatedAt)}</span>}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2.5">
                      <Link href={`/admin/broadcasts/${b.id}`} title="Analytics" aria-label="Analytics" className="text-muted-foreground hover:text-primary"><i className="ph-bold ph-chart-bar" aria-hidden /></Link>
                      <button onClick={() => openEdit(b)} title="Edit" aria-label="Edit" className="text-muted-foreground hover:text-foreground"><i className="ph-bold ph-pencil-simple" aria-hidden /></button>
                      <button onClick={() => duplicate(b)} title="Duplicate" aria-label="Duplicate" className="text-muted-foreground hover:text-foreground"><i className="ph-bold ph-copy" aria-hidden /></button>
                      {b.active
                        ? <button onClick={() => setActive(b.id, false)} title="Recall (stop delivering)" aria-label="Recall" className="text-muted-foreground hover:text-amber-600"><i className="ph-bold ph-arrow-u-up-left" aria-hidden /></button>
                        : <button onClick={() => setActive(b.id, true)} title="Restore" aria-label="Restore" className="text-muted-foreground hover:text-emerald-600"><i className="ph-bold ph-arrow-clockwise" aria-hidden /></button>}
                      <button onClick={() => setConfirm({ id: b.id, title: b.title })} title="Delete" aria-label="Delete" className="text-muted-foreground hover:text-destructive"><i className="ph-bold ph-trash" aria-hidden /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{q ? <>No messages match “{query}”.</> : <>No messages yet — <button onClick={openNew} className="font-semibold text-primary hover:underline">send one</button>.</>}</td></tr>}
          </tbody>
        </table>
      </div>

      {activity.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><i className="ph-bold ph-clock-counter-clockwise text-muted-foreground" aria-hidden /> Recent activity</p>
          <ul className="space-y-1.5">
            {activity.slice(0, 8).map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px]">
                <i className={`ph-bold ${a.icon} text-muted-foreground`} aria-hidden />
                <span className="font-semibold">{a.action}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.title}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{ago(a.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {composer.open && <BroadcastComposer editing={composer.editing} onSave={onSave} onClose={() => setComposer({ open: false, editing: null })} />}

      {confirm && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="modal-in relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="flex items-start gap-2 text-sm"><i className="ph-bold ph-warning-circle mt-0.5 text-amber-500" aria-hidden />Delete &ldquo;{confirm.title}&rdquo;? This removes it for everyone. To stop delivery without deleting, use Recall.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
              <button onClick={() => { removeBroadcast(confirm.id); setConfirm(null); }} className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} aria-hidden /></div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
