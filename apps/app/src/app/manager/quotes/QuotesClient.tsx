'use client';

import { useMemo, useState, useTransition } from 'react';
import { money } from '@/data/adminMock';
import { createQuoteAction } from './quote.actions';
import type { Quote, QuoteStatus } from '@/data/quotes.server';

const STATUS: Record<QuoteStatus, { label: string; pill: string }> = {
  requested: { label: 'Needs a price', pill: 'pill-warn' },
  quoted: { label: 'Sent — waiting', pill: 'pill-live' },
  accepted: { label: 'Accepted', pill: 'pill-good' },
  declined: { label: 'Declined', pill: 'pill-bad' },
  expired: { label: 'Expired', pill: 'pill-bad' },
};

const stamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;

/**
 * Price a custom job and hand the customer a link.
 *
 * This is the one place a manager touches money, by design (capability `quotes.manage`). They set one
 * number on one quote — no wallet, no LTV, no other order's value. See 20260717150000_quotes.sql.
 */
export function QuotesClient({ quotes }: { quotes: Quote[] }) {
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(
    () => (tab === 'open' ? quotes.filter((q) => q.status === 'requested' || q.status === 'quoted') : quotes),
    [quotes, tab],
  );
  const needsPrice = quotes.filter((q) => q.status === 'requested').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
          {(['open', 'all'] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-md px-2.5 py-1 capitalize transition ${tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {k === 'open' ? `Open · ${quotes.filter((q) => q.status === 'requested' || q.status === 'quoted').length}` : `All · ${quotes.length}`}
            </button>
          ))}
        </div>
        {needsPrice > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <i className="ph-bold ph-hourglass-medium" aria-hidden />{needsPrice} waiting on a price
          </span>
        )}
      </div>

      <div className="space-y-2">
        {rows.map((q) => (
          <QuoteCard key={q.id} q={q} editing={editing === q.id}
            onEdit={() => setEditing(q.id)} onClose={() => setEditing(null)}
            onDone={(m) => { setToast(m); setTimeout(() => setToast(null), 4000); setEditing(null); }} />
        ))}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <i className="ph-bold ph-scroll mb-2 block text-2xl text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {tab === 'open' ? 'No open quotes — nothing is waiting on you.' : 'No quotes yet.'}
            </p>
          </div>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function QuoteCard({ q, editing, onEdit, onClose, onDone }: {
  q: Quote; editing: boolean; onEdit: () => void; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [amount, setAmount] = useState(q.amount ? String(q.amount) : '');
  const [note, setNote] = useState(q.quoteNote ?? '');
  const [days, setDays] = useState('14');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const link = typeof window !== 'undefined' ? `${window.location.origin}/quote/${q.token}` : `/quote/${q.token}`;
  const open = q.status === 'requested' || q.status === 'quoted';

  const save = () => start(async () => {
    setErr(null);
    const res = await createQuoteAction(q.id, Number(amount), note, Number(days));
    if (!res.ok) { setErr(res.error); return; }
    onDone(`Quote sent to ${q.customer} — ${money(Number(amount))}. Copy the link to share it.`);
  });

  const copy = () => { void navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {q.customer}
            <span className="text-muted-foreground">· {q.service} — {q.packageName}</span>
            <span className={`pill ${STATUS[q.status].pill}`}>{STATUS[q.status].label}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Asked {stamp(q.at)} UTC
            {q.quotedBy && q.quotedAt && <> · priced by {q.quotedBy} on {stamp(q.quotedAt)}</>}
            {q.expiresAt && q.status === 'quoted' && <> · valid until {q.expiresAt.slice(0, 10)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {q.amount !== null && <span className="display text-xl font-bold">{money(q.amount)}</span>}
          {open && !editing && (
            <button onClick={onEdit} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110">
              {q.status === 'requested' ? 'Set a price' : 'Re-price'}
            </button>
          )}
        </div>
      </div>

      {q.ask && <p className="mt-2 rounded-lg border border-border bg-background/40 p-2.5 text-xs text-muted-foreground">{q.ask}</p>}

      {q.status === 'quoted' && !editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-[11px]">{link}</code>
          <button onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent">
            <i className={`ph-bold ${copied ? 'ph-check' : 'ph-copy'}`} aria-hidden />{copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2.5">
            <label className="min-w-[8rem] flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount (USD)</span>
              <input type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <label className="w-32">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Valid (days)</span>
              <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Note to the customer</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="What's included, timeline, anything they should know before they accept."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">
              {pending ? 'Sending…' : q.status === 'requested' ? 'Send quote' : 'Update quote'}
            </button>
            <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
            <span className="text-[11px] text-muted-foreground">Nothing is charged until the customer accepts.</span>
          </div>
        </div>
      )}
    </div>
  );
}
