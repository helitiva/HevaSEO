'use client';
import { useState } from 'react';

export interface ThreadMessage { who: string; body: string; internal: boolean; at: string; }

// Shared two-thread chat. The composer carries a recipient label that flips with the active tab,
// so an internal note is never posted to the customer by mistake (the leak guard, D5).
export function MessageThread({ initial, className }: { initial: ThreadMessage[]; className?: string }) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initial);
  const [tab, setTab] = useState<'customer' | 'internal'>('customer');
  const [draft, setDraft] = useState('');
  const internal = tab === 'internal';
  const shown = messages.filter((m) => m.internal === internal);

  function send() {
    const body = draft.trim();
    if (!body) return;
    setMessages((m) => [...m, { who: 'You', body, internal, at: 'now' }]);
    setDraft('');
  }

  return (
    <div className={`kcard flex flex-col ${className ?? ''}`}>
      <div role="tablist" aria-label="Message threads" className="mb-3 grid grid-cols-2 gap-1.5">
        <button role="tab" aria-selected={!internal} onClick={() => setTab('customer')}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${!internal ? 'bg-primary/10 text-primary ring-2 ring-primary/40' : 'bg-muted text-muted-foreground'}`}>
          <i className="ph-bold ph-user" aria-hidden /> Customer
        </button>
        <button role="tab" aria-selected={internal} onClick={() => setTab('internal')}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${internal ? 'bg-amber-500/15 text-amber-600 ring-2 ring-amber-500/40 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
          <i className="ph-bold ph-lock-simple" aria-hidden /> Internal
        </button>
      </div>

      <p className={`mb-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${internal ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'}`}>
        <i className={`ph-bold ${internal ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden />
        {internal ? 'Only staff & admin can see this thread' : 'The customer can read this thread'}
      </p>

      <div className="flex min-h-[14rem] flex-1 flex-col gap-2 overflow-y-auto">
        {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Start the conversation.</p>}
        {shown.map((m, i) => {
          const mine = m.who === 'You';
          return (
            <div key={i} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <span className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${mine ? (internal ? 'bg-amber-500/15' : 'bg-primary/15') : 'bg-muted'}`}>{m.body}</span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">{m.who} · {m.at}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <p className={`mb-1 flex items-center gap-1 text-[11px] font-semibold ${internal ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
          <i className={`ph-bold ${internal ? 'ph-lock-simple' : 'ph-paper-plane-tilt'}`} aria-hidden />
          {internal ? 'Internal note' : 'Sending to: Customer'}
        </p>
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={internal ? 'Add an internal note…' : 'Reply to customer…'}
            className={`flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary ${internal ? 'border-amber-500/40' : 'border-border'}`} />
          <button onClick={send} aria-label="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><i className="ph-bold ph-paper-plane-tilt" aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}
