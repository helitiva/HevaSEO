'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useInbox } from '@/data/broadcastStore';
import { useBroadcastAudience } from '@/lib/broadcastAudience';
import { KIND_META, type BroadcastKind } from '@/data/broadcasts';
import { ago } from '@/lib/relativeTime';

// One inbox UI, mounted by every recipient portal (customer / staff / manager / affiliate).
// Lists the broadcasts for this surface's audience; a message collapses to a snippet and
// expands on click (long-form messages can carry a full rich article). Clicking marks it read
// (synced with the bell). Pinned + newest first.
export function InboxClient() {
  const aud = useBroadcastAudience();
  const { items, unread, markRead, markAllRead, isRead } = useInbox(aud);
  const [filter, setFilter] = useState<'all' | BroadcastKind>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const kindsPresent = [...new Set(items.map((b) => b.kind))];
  const shown = filter === 'all' ? items : items.filter((b) => b.kind === filter);

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Messages &amp; announcements from the HevaSEO team{unread > 0 && <> · <span className="font-semibold text-foreground">{unread} unread</span></>}.</p>
        </div>
        {unread > 0 && <button onClick={markAllRead} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:bg-accent"><i className="ph-bold ph-checks mr-1" />Mark all read</button>}
      </div>

      {kindsPresent.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All <span className="opacity-70">{items.length}</span></Chip>
          {kindsPresent.map((k) => { const m = KIND_META[k]; return (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)}><i className={`ph-bold ${m.icon}`} style={{ color: m.color }} /> {m.label}</Chip>
          ); })}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <i className="ph-bold ph-tray mb-1 block text-2xl text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">No messages here yet.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((b) => {
            const m = KIND_META[b.kind];
            const read = isRead(b.id);
            const expanded = openId === b.id;
            const expandable = Boolean(b.article) || b.body.length > 160;
            const toggle = () => { const next = expanded ? null : b.id; setOpenId(next); if (next) markRead(b.id); };
            return (
              <li key={b.id}>
                <div onClick={toggle} role="button" tabIndex={0} aria-expanded={expanded}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                  className={`group relative cursor-pointer rounded-2xl border p-4 transition hover:border-primary/40 ${read ? 'border-border bg-card' : 'border-primary/30 bg-primary/5'}`}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${m.color}1f`, color: m.color }}><i className={`ph-fill ${m.icon} text-lg`} aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${m.color}1a`, color: m.color }}>{m.label}</span>
                        {b.pinned && <i className="ph-fill ph-push-pin text-amber-500" title="Pinned" aria-hidden />}
                        {b.article && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><i className="ph-bold ph-article" />Article</span>}
                        <span className="ml-auto text-[11px] text-muted-foreground">{ago(b.createdAt)}</span>
                        {!read && <span className="h-2 w-2 rounded-full bg-primary" aria-label="unread" />}
                        {expandable && <i className={`ph-bold ph-caret-down text-muted-foreground transition ${expanded ? 'rotate-180' : ''}`} aria-hidden />}
                      </div>
                      <p className={`mt-1 ${read ? 'font-semibold' : 'font-bold'}`}>{b.title}</p>
                      <p className={`mt-0.5 whitespace-pre-line text-sm text-muted-foreground ${expanded ? '' : 'line-clamp-2'}`}>{b.body}</p>
                      {expanded && b.article && (
                        <div className="note-html mt-3 border-t border-border pt-3 text-[15px] leading-relaxed text-foreground/90" onClick={(e) => e.stopPropagation()} dangerouslySetInnerHTML={{ __html: b.article }} />
                      )}
                      <div className="mt-2 flex items-center gap-3">
                        {b.cta && (
                          <Link href={b.cta.href} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90" style={{ background: m.color }}>
                            {b.cta.label} <i className="ph-bold ph-arrow-right" aria-hidden />
                          </Link>
                        )}
                        {expandable && <span className="text-xs font-semibold text-primary">{expanded ? 'Show less' : 'Read more'}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>{children}</button>
  );
}
