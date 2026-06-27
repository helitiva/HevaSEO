'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/staff/EmptyState';
import { NOTIF_META, type StaffNotification, type StaffNotifKind } from '@/data/staffMock';
import { dayBucket, type DayBucket } from '@/lib/staff';

const URGENT: StaffNotifKind[] = ['changes', 'penalty'];
const BUCKETS: DayBucket[] = ['Today', 'Yesterday', 'Earlier'];

export function NotificationsClient({ initial }: { initial: StaffNotification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [kind, setKind] = useState<'all' | StaffNotifKind>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const unread = items.filter((n) => !n.read).length;
  const targetOf = (n: StaffNotification) => (n.taskId ? `/staff/tasks/${n.taskId}` : n.href);
  const kinds = useMemo(() => [...new Set(items.map((n) => n.kind))], [items]);
  const countOf = (k: StaffNotifKind) => items.filter((n) => n.kind === k).length;

  const shown = useMemo(
    () => items
      .filter((n) => (kind === 'all' || n.kind === kind) && (!unreadOnly || !n.read))
      .sort((a, b) => b.ts.localeCompare(a.ts)),
    [items, kind, unreadOnly],
  );
  const grouped = useMemo(
    () => BUCKETS.map((b) => ({ bucket: b, rows: shown.filter((n) => dayBucket(n.ts) === b) })).filter((g) => g.rows.length),
    [shown],
  );

  const markAll = () => setItems((xs) => xs.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setItems((xs) => xs.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const dismiss = (id: string) => setItems((xs) => xs.filter((n) => n.id !== id));
  const open = (n: StaffNotification) => { markRead(n.id); const t = targetOf(n); if (t) router.push(t); };

  if (items.length === 0) return <EmptyState kind="caught-up" />;

  return (
    <>
      {/* category filter */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Chip active={kind === 'all'} onClick={() => setKind('all')}>All <span className="opacity-60">{items.length}</span></Chip>
        {kinds.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
            <i className={`ph-bold ${NOTIF_META[k].icon} ${NOTIF_META[k].tone}`} aria-hidden /> {NOTIF_META[k].label} <span className="opacity-60">{countOf(k)}</span>
          </Chip>
        ))}
      </div>

      {/* read-state controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setUnreadOnly((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${unreadOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          <i className={`ph-bold ${unreadOnly ? 'ph-check-square' : 'ph-square'}`} aria-hidden /> Unread only
          {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{unread}</span>}
        </button>
        <button
          onClick={markAll}
          disabled={unread === 0}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition enabled:hover:bg-accent disabled:opacity-40"
        >
          <i className="ph-bold ph-checks" aria-hidden /> Mark all read
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="kcard flex flex-col items-center gap-2 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500"><i className="ph-bold ph-check-circle text-2xl" aria-hidden /></span>
          <p className="display text-lg font-bold">Nothing here</p>
          <p className="text-sm text-muted-foreground">{unreadOnly ? 'No unread notifications in this view.' : 'No notifications match this filter.'}</p>
          {(kind !== 'all' || unreadOnly) && (
            <button onClick={() => { setKind('all'); setUnreadOnly(false); }} className="mt-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.bucket}>
              <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.bucket}</p>
              <ul className="space-y-2">
                {g.rows.map((n) => {
                  const m = NOTIF_META[n.kind];
                  const accent = n.kind === 'penalty' ? 'border-l-2 border-l-red-500' : n.kind === 'changes' ? 'border-l-2 border-l-amber-500' : '';
                  return (
                    <li key={n.id} className="relative">
                      <button
                        onClick={() => open(n)}
                        className={`block w-full rounded-xl border border-border bg-card p-3 pr-9 text-left transition hover:border-primary/40 ${accent} ${n.read ? 'opacity-70' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted ${m.tone}`}>
                            <i className={`ph-bold ${m.icon}`} aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                              <p className="truncate text-sm font-semibold">{n.title}</p>
                              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{n.at}</span>
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${m.tone}`}>{m.label}</span>
                              {targetOf(n) && (
                                <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-primary">{m.action} <i className="ph-bold ph-arrow-right" aria-hidden /></span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                        title="Dismiss"
                        aria-label={`Dismiss ${n.title}`}
                        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <i className="ph-bold ph-x text-xs" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </button>
  );
}
