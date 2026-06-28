'use client';
import { useMemo, useState } from 'react';
import { useBroadcasts } from '@/data/broadcastStore';
import { BroadcastComposer } from './BroadcastComposer';
import { KIND_META, AUDIENCE_META, isLive, type Broadcast } from '@/data/broadcasts';
import { ago } from '@/lib/relativeTime';

function statusOf(b: Broadcast): { label: string; cls: string } {
  if (!b.active) return { label: 'Recalled', cls: 'pill-warn' };
  if (b.expiresAt && new Date(b.expiresAt).getTime() < Date.now()) return { label: 'Expired', cls: '' };
  return { label: 'Live', cls: 'pill-live' };
}

// Admin control room for broadcasts: compose, see who each message went to and how it's shown,
// edit, recall/restore, or delete. Recall stops it reaching recipients without deleting it.
export function BroadcastsManager() {
  const { all, saveBroadcast, setActive, removeBroadcast, isSeed } = useBroadcasts();
  const [composer, setComposer] = useState<{ open: boolean; editing: Broadcast | null }>({ open: false, editing: null });
  const [confirm, setConfirm] = useState<{ id: string; title: string } | null>(null);

  const live = useMemo(() => all.filter((b) => isLive(b)).length, [all]);
  const banners = useMemo(() => all.filter((b) => isLive(b) && b.banner).length, [all]);
  const recalled = useMemo(() => all.filter((b) => !b.active).length, [all]);

  const openNew = () => setComposer({ open: true, editing: null });
  const openEdit = (b: Broadcast) => setComposer({ open: true, editing: b });
  const onSave = (b: Broadcast) => { saveBroadcast(b); setComposer({ open: false, editing: null }); };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Broadcasts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Send notices, announcements &amp; alerts to customers, staff, managers or affiliates.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-plus" /> New message</button>
      </div>

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
            {all.map((b) => {
              const m = KIND_META[b.kind];
              const st = statusOf(b);
              return (
                <tr key={b.id} className="border-b border-border/50 align-top transition hover:bg-muted/40">
                  <td className="p-3">
                    <button onClick={() => openEdit(b)} className="text-left font-semibold hover:text-primary hover:underline">{b.title}</button>
                    {b.pinned && <i className="ph-fill ph-push-pin ml-1.5 text-amber-500" title="Pinned" />}
                    <p className="line-clamp-1 max-w-md text-[11px] text-muted-foreground">{b.body}</p>
                  </td>
                  <td className="p-3"><span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: `${m.color}1a`, color: m.color }}><i className={`ph-fill ${m.icon}`} />{m.label}</span></td>
                  <td className="p-3"><span className="flex flex-wrap gap-1">{b.audiences.map((a) => { const am = AUDIENCE_META[a]; return <span key={a} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${am.color}1a`, color: am.color }}><i className={`ph-fill ${am.icon}`} />{am.label}</span>; })}</span></td>
                  <td className="p-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ph-bold ph-bell" title="Inbox + bell" />
                      {b.banner && <i className="ph-bold ph-flag-banner text-primary" title="Overview banner" />}
                      {b.cta && <i className="ph-bold ph-link-simple" title={`CTA: ${b.cta.label}`} />}
                    </span>
                  </td>
                  <td className="p-3"><span className={`pill ${st.cls}`}>{st.label}</span></td>
                  <td className="p-3 text-muted-foreground">{ago(b.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2.5">
                      <button onClick={() => openEdit(b)} title="Edit" className="text-muted-foreground hover:text-foreground"><i className="ph-bold ph-pencil-simple" /></button>
                      {b.active
                        ? <button onClick={() => setActive(b.id, false)} title="Recall (stop delivering)" className="text-muted-foreground hover:text-amber-600"><i className="ph-bold ph-arrow-u-up-left" /></button>
                        : <button onClick={() => setActive(b.id, true)} title="Restore" className="text-muted-foreground hover:text-emerald-600"><i className="ph-bold ph-arrow-clockwise" /></button>}
                      <button onClick={() => setConfirm({ id: b.id, title: b.title })} title={isSeed(b.id) ? 'Hide' : 'Delete'} className="text-muted-foreground hover:text-destructive"><i className="ph-bold ph-trash" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {all.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No messages yet — <button onClick={openNew} className="font-semibold text-primary hover:underline">send one</button>.</td></tr>}
          </tbody>
        </table>
      </div>

      {composer.open && <BroadcastComposer editing={composer.editing} onSave={onSave} onClose={() => setComposer({ open: false, editing: null })} />}

      {confirm && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="modal-in relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="flex items-start gap-2 text-sm"><i className="ph-bold ph-warning-circle mt-0.5 text-amber-500" />Delete “{confirm.title}”? This removes it for everyone. To stop delivery without deleting, use Recall.</p>
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
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} /></div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
