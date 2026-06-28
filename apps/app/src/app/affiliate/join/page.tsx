import type { Metadata } from 'next';
import Link from 'next/link';
import { JoinClient } from './JoinClient';
import { AFFILIATE_TIERS } from '@/lib/affiliate';
import { PayoutTicker } from '@/components/affiliate/PayoutTicker';
import { Countdown } from '@/components/affiliate/Countdown';
import { programStats, joinOffer } from '@/data/affiliatePulse';
import { money } from '@/data/adminMock';

export const metadata: Metadata = {
  title: 'Become a HevaSEO affiliate',
  description: 'Earn recurring commission on every order from customers you refer.',
};

const topRate = Math.round(Math.max(...AFFILIATE_TIERS.map((t) => t.rate)) * 100);
const stats = programStats();
const offer = joinOffer();

const BENEFITS = [
  { icon: 'ph-percent', title: `Up to ${topRate}% commission`, body: 'Your rate climbs as your referred volume grows — four tiers, no caps.' },
  { icon: 'ph-repeat', title: 'Recurring & lifetime', body: 'Referrals are yours for life. Every repeat order keeps paying you.' },
  { icon: 'ph-lightning', title: 'Instant approval', body: 'Sign up and your link works immediately. Start sharing in seconds.' },
  { icon: 'ph-chart-line-up', title: 'Real-time dashboard', body: 'Track clicks, signups, volume, and earnings — all in one place.' },
];

export default function AffiliateJoinPage() {
  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground">
      {/* top bar */}
      <header className="flex h-[68px] items-center justify-between px-5 lg:px-10">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">H</span>
          <span className="display text-sm font-bold">HevaSEO <span className="text-primary">Partners</span></span>
        </span>
        <Link href="/affiliate" className="text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          Already a partner? <span className="text-primary">Sign in</span>
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-6 lg:grid-cols-2 lg:gap-14 lg:px-10 lg:pt-12">
        {/* pitch */}
        <section className="lg:pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-primary">
              <i className="ph-fill ph-megaphone" /> Affiliate program
            </span>
            <PayoutTicker />
          </div>
          <h1 className="display mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Get paid to share the SEO partner you{' '}
            <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">already trust</span>.
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            Join the HevaSEO affiliate program, get a personal link and code, and earn recurring
            commission on every order from the customers you bring in.
          </p>

          {/* social proof */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border bg-card/60 px-5 py-4">
            <div>
              <p className="text-xl font-bold tracking-tight">{stats.partners.toLocaleString('en-US')}+</p>
              <p className="text-xs text-muted-foreground">active partners</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xl font-bold tracking-tight text-emerald-600">{money(stats.paidLastMonth)}</p>
              <p className="text-xs text-muted-foreground">paid out last month</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xl font-bold tracking-tight">{money(stats.topEarnerMonth)}</p>
              <p className="text-xs text-muted-foreground">top earner / month</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-card p-4">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                  <i className={`ph-bold ${b.icon}`} />
                </span>
                <p className="mt-3 text-sm font-bold">{b.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>

          {/* tier strip */}
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold">Tiers:</span>
            {AFFILIATE_TIERS.map((t, i) => (
              <span key={t.id} className="inline-flex items-center gap-1.5">
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">{t.label} {Math.round(t.rate * 100)}%</span>
                {i < AFFILIATE_TIERS.length - 1 && <i className="ph-bold ph-caret-right text-[10px]" />}
              </span>
            ))}
          </div>
        </section>

        {/* form */}
        <section className="lg:pt-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/[0.14] to-card px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-600">
                <i className="ph-fill ph-gift" />
              </span>
              <div>
                <p className="text-sm font-bold">{offer.headline}</p>
                <p className="text-xs text-muted-foreground">{offer.detail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ends in</span>
              <Countdown to={offer.endsAt} />
            </div>
          </div>
          <JoinClient />
        </section>
      </main>
    </div>
  );
}
