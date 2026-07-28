'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { money } from '@/data/adminMock';
import { acceptQuoteAction, declineQuoteAction } from '@/app/manager/quotes/quote.actions';
import type { Quote } from '@/data/quotes.server';

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

/**
 * The customer's view of a custom quote. Accepting debits their wallet for exactly the quoted amount
 * and creates the order — so the amount, what it covers, and what they'll have left are all on screen
 * BEFORE the button. Nothing about this page should be able to surprise someone into spending.
 */
export function QuoteView({ quote, balance }: { quote: Quote; balance: number }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const amount = quote.amount ?? 0;
  const short = amount - balance;
  const canPay = balance >= amount;
  const expired = quote.status === 'expired' || (!!quote.expiresAt && new Date(quote.expiresAt) < new Date());
  const open = quote.status === 'quoted' && !expired;

  const accept = () => start(async () => {
    setErr(null);
    const res = await acceptQuoteAction(quote.token);
    if (!res.ok) { setErr(res.error); setConfirming(false); return; }
    router.push('/orders');
  });
  const decline = () => start(async () => {
    setErr(null);
    const res = await declineQuoteAction(quote.token);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your quote</p>
        <h1 className="display mt-1 text-2xl font-bold tracking-tight">{quote.service} — {quote.packageName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prepared{quote.quotedBy ? ` by ${quote.quotedBy}` : ''}{day(quote.quotedAt) ? ` on ${day(quote.quotedAt)}` : ''}
          {day(quote.expiresAt) && open && <> · valid until <b className="text-foreground">{day(quote.expiresAt)}</b></>}
        </p>

        <div className="mt-5 rounded-xl border border-border bg-background/40 p-5">
          <p className="text-xs text-muted-foreground">Total for this job</p>
          <p className="display text-4xl font-bold leading-tight">{money(amount)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">One-off. Charged from your credit balance when you accept.</p>
        </div>

        {quote.quoteNote && (
          <div className="mt-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What&apos;s included</p>
            <p className="whitespace-pre-wrap rounded-xl border border-border bg-background/40 p-3.5 text-sm">{quote.quoteNote}</p>
          </div>
        )}

        {quote.brief.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What you asked for</p>
            <dl className="divide-y divide-border/60 rounded-xl border border-border">
              {quote.brief.map((b, i) => (
                <div key={i} className="flex gap-3 px-3.5 py-2 text-sm">
                  <dt className="w-40 shrink-0 text-muted-foreground">{b.label}</dt>
                  <dd className="min-w-0 flex-1">{b.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* ── the decision ── */}
        {open && (
          <div className="mt-5 border-t border-border pt-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your credit balance</span>
              <span className={`font-semibold tabular-nums ${canPay ? '' : 'text-amber-600'}`}>{money(balance)}</span>
            </div>
            {canPay ? (
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Left after accepting</span>
                <span className="font-semibold tabular-nums">{money(balance - amount)}</span>
              </div>
            ) : (
              <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-500">
                You&apos;re <b>{money(short)}</b> short. Top up and come back to this link — the quote stays open
                {day(quote.expiresAt) ? ` until ${day(quote.expiresAt)}` : ''}.
              </div>
            )}
            {err && <p role="alert" className="mb-3 text-xs text-destructive">{err}</p>}

            {confirming ? (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5">
                <p className="text-sm font-semibold">Accept and pay {money(amount)}?</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  This charges your credit now and starts the work. It can&apos;t be undone from here.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={accept} disabled={pending}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">
                    {pending ? 'Charging…' : `Yes — pay ${money(amount)}`}
                  </button>
                  <button onClick={() => setConfirming(false)} disabled={pending}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Back</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {canPay ? (
                  <button onClick={() => setConfirming(true)} disabled={pending}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">
                    Accept &amp; pay {money(amount)}
                  </button>
                ) : (
                  <Link href="/credit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
                    Top up {money(short)}
                  </Link>
                )}
                <button onClick={decline} disabled={pending}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent">
                  Decline
                </button>
              </div>
            )}
          </div>
        )}

        {!open && (
          <div className="mt-5 rounded-xl border border-border bg-background/40 p-4 text-sm">
            {quote.status === 'accepted' && <p className="font-semibold text-emerald-600"><i className="ph-bold ph-check-circle mr-1" aria-hidden />Accepted — the work is under way. <Link href="/orders" className="text-primary hover:underline">Track your order →</Link></p>}
            {quote.status === 'declined' && <p className="text-muted-foreground">You declined this quote. <Link href="/support" className="text-primary hover:underline">Talk to us</Link> if you&apos;d like another look.</p>}
            {expired && quote.status !== 'accepted' && quote.status !== 'declined' && (
              <p className="text-muted-foreground">This quote has expired. <Link href="/support" className="text-primary hover:underline">Ask for a fresh one</Link> — prices may have changed.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
