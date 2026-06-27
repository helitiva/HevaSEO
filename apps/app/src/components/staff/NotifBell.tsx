'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { STAFF_NOTIFICATIONS, NOTIF_META, type StaffNotification } from '@/data/staffMock';

// Topbar notification bell with a dropdown preview of the most recent notifications.
// Session-local state (a real app would share a store / server source with the full page).
export function NotifBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(STAFF_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;
  const recent = [...items].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 6);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const markAll = () => setItems((xs) => xs.map((n) => ({ ...n, read: true })));
  const openNotif = (n: StaffNotification) => {
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    const t = n.taskId ? `/staff/tasks/${n.taskId}` : n.href;
    setOpen(false);
    if (t) router.push(t);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent"
      >
        <i className="ph-bold ph-bell text-lg" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[23rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <i className="ph-bold ph-bell text-primary" aria-hidden /> Notifications
              {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{unread}</span>}
            </p>
            <button onClick={markAll} disabled={unread === 0} className="flex items-center gap-1 text-[11px] font-semibold text-primary transition disabled:opacity-40">
              <i className="ph-bold ph-checks" aria-hidden /> Mark all read
            </button>
          </div>

          <ul className="max-h-[60vh] divide-y divide-border/60 overflow-auto">
            {recent.map((n) => {
              const m = NOTIF_META[n.kind];
              return (
                <li key={n.id}>
                  <button
                    onClick={() => openNotif(n)}
                    className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-muted/50 ${n.read ? 'opacity-65' : 'bg-primary/[0.03]'}`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted ${m.tone}`}>
                      <i className={`ph-bold ${m.icon} text-sm`} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                        <span className="truncate text-[13px] font-semibold">{n.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{n.at}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[12px] text-muted-foreground">{n.body}</span>
                      <span className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${m.tone}`}>
                        {m.action} <i className="ph-bold ph-arrow-right" aria-hidden />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {recent.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted-foreground">You’re all caught up 🎉</li>}
          </ul>

          <Link
            href="/staff/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2.5 text-center text-[13px] font-semibold text-primary transition hover:bg-muted/50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
