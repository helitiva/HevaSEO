'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInbox, markBroadcastClicked } from '@/data/broadcastStore';
import { useBroadcastAudience, inboxHref } from '@/lib/broadcastAudience';
import { KIND_META, type Broadcast } from '@/data/broadcasts';

// Shows a toast when a NEW broadcast arrives for this audience while the user is on the page
// (the store syncs across the app via events). First load is silent — only genuinely new
// messages toast. Mounted in each recipient shell.
export function BroadcastToaster() {
  const aud = useBroadcastAudience();
  const { items } = useInbox(aud);
  const known = useRef<Set<string> | null>(null);
  const [toast, setToast] = useState<Broadcast | null>(null);

  useEffect(() => {
    const ids = items.map((i) => i.id);
    if (known.current === null) { known.current = new Set(ids); return; } // skip initial load
    const fresh = items.find((i) => !known.current!.has(i.id));
    known.current = new Set(ids);
    if (fresh) setToast(fresh);
  }, [items]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const m = KIND_META[toast.kind];
  return (
    <Link href={toast.cta?.href ?? inboxHref(aud)} onClick={() => { if (toast.cta) markBroadcastClicked(aud, toast.id); setToast(null); }}
      className="toast-in fixed bottom-4 right-4 z-[95] flex w-80 items-start gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xl transition hover:border-primary/40">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${m.color}1f`, color: m.color }}><i className={`ph-fill ${m.icon} text-lg`} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">New message</p>
        <p className="truncate text-sm font-semibold">{toast.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{toast.body}</p>
      </div>
      <button onClick={(e) => { e.preventDefault(); setToast(null); }} aria-label="Dismiss" className="shrink-0 text-muted-foreground hover:text-foreground"><i className="ph-bold ph-x" /></button>
    </Link>
  );
}
