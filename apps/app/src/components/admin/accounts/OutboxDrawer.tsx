'use client';
import { useState } from 'react';
import { useOutbox, type OutboxMail } from '@/lib/auth';

const KIND_META: Record<OutboxMail['kind'], { label: string; icon: string; color: string }> = {
  credentials: { label: 'Credentials', icon: 'ph-key', color: '#0ea5e9' },
  reset: { label: 'Password reset', icon: 'ph-arrow-counter-clockwise', color: '#f59e0b' },
  welcome: { label: 'Welcome', icon: 'ph-hand-waving', color: '#10b981' },
};

// A self-contained button + drawer that re-shows the mock outbox (credential / reset /
// welcome emails the system "sent"). Phase-0: there's no real mail server, so this is
// the audit trail. Drop it into any admin header.
export function OutboxButton() {
  const [open, setOpen] = useState(false);
  const mail = useOutbox();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View sent account emails (mock outbox)"
        className="relative rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:bg-accent"
      >
        <i className="ph-bold ph-envelope-simple mr-1" aria-hidden />Outbox
        {mail.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{mail.length}</span>}
      </button>
      {open && <OutboxDrawer mail={mail} onClose={() => setOpen(false)} />}
    </>
  );
}

function OutboxDrawer({ mail, onClose }: { mail: OutboxMail[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-in relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="display flex items-center gap-2 text-base font-bold"><i className="ph-bold ph-envelope-simple text-primary" aria-hidden /> Mock outbox</p>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><i className="ph-bold ph-x" aria-hidden /></button>
        </div>
        <p className="border-b border-border px-5 py-2 text-[11px] text-muted-foreground">No real email is sent in Phase-0 — credentials & reset emails land here.</p>
        <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {mail.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No emails sent yet.</p>
          ) : mail.map((mm) => { const k = KIND_META[mm.kind]; return (
            <div key={mm.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${k.color}22`, color: k.color }}><i className={`ph-fill ${k.icon}`} aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{mm.subject}</p>
                  <p className="truncate text-[11px] text-muted-foreground">To {mm.to} · {new Date(mm.at).toLocaleString()}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${k.color}1a`, color: k.color }}>{k.label}</span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs text-muted-foreground">{mm.body}</pre>
            </div>
          ); })}
        </div>
      </div>
    </div>
  );
}
