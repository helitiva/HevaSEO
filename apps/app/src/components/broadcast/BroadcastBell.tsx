'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInbox } from '@/data/broadcastStore';
import { useBroadcastAudience, inboxHref } from '@/lib/broadcastAudience';
import { KIND_META } from '@/data/broadcasts';
import { ago } from '@/lib/relativeTime';

// Topbar notification bell — unread broadcast count + a dropdown preview. Reuses the same inbox
// store as the full Inbox page, so reading here clears it everywhere. Mounted in each recipient
// portal's topbar.
export function BroadcastBell() {
  const aud = useBroadcastAudience();
  const { items, unread, isRead, markRead, markAllRead } = useInbox(aud);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const href = inboxHref(aud);
  const recent = items.slice(0, 6);

  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Messages${mounted && unread ? `, ${unread} unread` : ''}`} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent">
        <i className="ph-bold ph-envelope-simple text-lg" aria-hidden />
        {mounted && unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-card">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="pop-in absolute right-0 z-[90] mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Messages {unread > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">· {unread} new</span>}</p>
            {unread > 0 && <button onClick={markAllRead} className="text-[11px] font-semibold text-primary hover:underline">Mark all read</button>}
          </div>
          <ul className="scrollbar-thin max-h-80 divide-y divide-border overflow-y-auto">
            {recent.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No messages yet.</li>}
            {recent.map((b) => {
              const m = KIND_META[b.kind];
              const read = isRead(b.id);
              return (
                <li key={b.id}>
                  <Link href={b.cta?.href ?? href} onClick={() => { markRead(b.id); setOpen(false); }}
                    className={`flex gap-2.5 px-3 py-2.5 transition hover:bg-accent ${read ? '' : 'bg-primary/5'}`}>
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${m.color}1f`, color: m.color }}><i className={`ph-fill ${m.icon}`} aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${read ? 'font-medium' : 'font-semibold'}`}>{b.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{b.body}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{ago(b.createdAt)}</p>
                    </div>
                    {!read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href={href} onClick={() => setOpen(false)} className="block border-t border-border px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-accent">View all in inbox</Link>
        </div>
      )}
    </div>
  );
}
