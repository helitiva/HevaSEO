'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getMyTicketsAction, getTicketThreadAction, createTicketAction, postTicketMessageAction } from '@/app/(portal)/tickets.actions';

const SPECIALIST = { name: 'Olivia Chen', role: 'SEO Lead', initials: 'OC', replies: 'replies < 2h' };
const QUICK_REPLIES = ["What's my campaign status?", 'I need a new article', 'Can we review the latest report?'];
// The live chat is backed by a real support ticket so messages reach the team and their replies come back.
const LIVE_SUBJECT = 'Live chat with your specialist';

type Msg = { from: 'them' | 'me'; text: string; time: string };

const now = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const GREETING: Msg = { from: 'them', text: "Hi! 👋 I'm Olivia, your SEO lead. How can I help with your campaigns today?", time: '' };

function Bubble({ m }: { m: Msg }) {
  const mine = m.from === 'me';
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed ${
          mine
            ? 'rounded-2xl rounded-tr-sm bg-primary text-primary-foreground'
            : 'rounded-2xl rounded-tl-sm bg-muted text-foreground'
        }`}
      >
        {m.text}
      </div>
      <span className="mt-1 px-1 text-[10px] text-muted-foreground">{m.time}</span>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  );
}

/** "Message specialist" button + a chat slide-over with the account's SEO lead.
 *  Pass `children` to use a custom trigger (e.g. a whole card). */
export function SpecialistChat({ className, children }: { className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const close = () => { setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); }, 230); };

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, typing, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // On open, resume the real live-chat ticket + its thread (including the team's replies).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void getMyTicketsAction().then(async (ts) => {
      const live = ts.find((t) => t.subject === LIVE_SUBJECT) ?? null;
      if (!alive || !live) return;
      setTicketId(live.id);
      const th = await getTicketThreadAction(live.id);
      if (alive) setMsgs([GREETING, ...th.map((m) => ({ from: (m.mine ? 'me' : 'them') as Msg['from'], text: m.body, time: fmt(m.createdAt) }))]);
    });
    return () => { alive = false; };
  }, [open]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { from: 'me', text: t, time: now() }]);
    setDraft('');
    setTyping(true);
    if (ticketId) {
      await postTicketMessageAction(ticketId, t);
    } else {
      const r = await createTicketAction(LIVE_SUBJECT, 'consultation', t); // opens the backing ticket
      if (r.ok) setTicketId(r.ticket.id);
    }
    setTyping(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {children ?? <><i className="ph-bold ph-chat-circle-dots" aria-hidden /> Message specialist</>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div className={`${closing ? 'order-backdrop-out' : 'order-backdrop'} absolute inset-0 bg-black/60 backdrop-blur-sm`} onClick={close} />
          <aside className={`${closing ? 'order-panel-out' : 'order-panel'} absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col border-l border-border bg-card`}>
            {/* header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                {SPECIALIST.initials}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{SPECIALIST.name}</p>
                <p className="text-xs text-muted-foreground">{SPECIALIST.role} · {SPECIALIST.replies}</p>
              </div>
              <button onClick={close} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent"><i className="ph-bold ph-x" aria-hidden /></button>
            </div>

            {/* thread */}
            <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <p className="text-center text-[11px] font-medium text-muted-foreground">Today</p>
              {msgs.map((m, i) => <Bubble key={i} m={m} />)}
              {typing && <div className="flex items-start"><Typing /></div>}
              <div ref={endRef} />
            </div>

            {/* quick replies */}
            <div className="flex flex-wrap gap-1.5 px-5 pb-2">
              {QUICK_REPLIES.map((q) => (
                <button key={q} onClick={() => send(q)} className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
                  {q}
                </button>
              ))}
            </div>

            {/* composer */}
            <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex items-end gap-2 border-t border-border p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={`Message ${SPECIALIST.name.split(' ')[0]}…`}
                className="scrollbar-thin max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button type="submit" disabled={!draft.trim()} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                <i className="ph-bold ph-paper-plane-tilt" aria-hidden />
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
