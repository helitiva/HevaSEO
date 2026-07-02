'use client';

import { useRouter, usePathname } from 'next/navigation';
import type { DeliveredOrder } from '@/data/orders.server';

// Customer-facing "your delivery is ready" list: one line per DELIVERED order + a countdown to
// auto-approval. Clicking a row opens the shared order-detail slide-over (?order=<code>), where the
// full brief, delivered work, and the Approve / Request-changes actions live.
const AUTO_APPROVE_GRACE_DAYS = 7; // keep in sync with auto_approve_stale_deliveries(p_grace_days)
const DAY_MS = 86_400_000;

function daysLeft(deliveredAt: string | null): number | null {
  if (!deliveredAt) return null;
  return Math.max(0, Math.ceil((new Date(deliveredAt).getTime() + AUTO_APPROVE_GRACE_DAYS * DAY_MS - Date.now()) / DAY_MS));
}
const countdownLabel = (n: number) => (n <= 0 ? 'Auto-approves today' : `Auto-approves in ${n} day${n === 1 ? '' : 's'}`);

export function DeliveredReview({ orders }: { orders: DeliveredOrder[] }) {
  const router = useRouter();
  const pathname = usePathname();
  if (!orders.length) return null;

  return (
    <section aria-labelledby="delivered-heading" className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-5">
      <div className="flex items-center gap-2">
        <i className="ph-bold ph-package text-primary" aria-hidden />
        <h2 id="delivered-heading" className="display text-lg font-semibold tracking-tight">Recent completed orders, ready for review</h2>
        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{orders.length}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Your team delivered these. Open one to review, approve, or send back — we’ll auto-approve after {AUTO_APPROVE_GRACE_DAYS} days if we don’t hear back.</p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {orders.map((o) => {
          const n = daysLeft(o.deliveredAt);
          const urgent = n !== null && n <= 2;
          return (
            <li key={o.id}>
              <button
                type="button" onClick={() => router.push(`${pathname}?order=${o.code}`, { scroll: false })}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition hover:border-primary/40 hover:bg-accent/50"
              >
                <i className="ph-bold ph-package shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{o.service}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{o.code}</span>
                </span>
                {n !== null && (
                  <span className={`hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold lg:inline-flex ${urgent ? 'bg-amber-500/10 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                    <i className="ph-bold ph-clock-countdown" aria-hidden />{countdownLabel(n)}
                  </span>
                )}
                <i className="ph-bold ph-caret-right shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
