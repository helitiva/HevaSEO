import { money } from '@/data/adminMock';
import { programStats } from '@/data/affiliatePulse';

const STEPS = [
  { icon: 'ph-share-fat', title: 'Share your link', body: 'Drop it in a post, bio, video, or newsletter.' },
  { icon: 'ph-shopping-bag-open', title: 'They order', body: 'Anyone who signs up through it is tagged to you — for life.' },
  { icon: 'ph-coins', title: 'You earn — forever', body: 'Every order they ever place pays you commission.' },
];

// Shown to a brand-new partner (no referrals yet): orient them and motivate the first share.
export function HowItWorks() {
  const stats = programStats();
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="relative">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <i className={`ph-bold ${s.icon}`} aria-hidden />
              </span>
              <span className="text-xs font-bold text-muted-foreground">Step {i + 1}</span>
            </div>
            <p className="mt-2 text-sm font-bold">{s.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <i className="ph-fill ph-users-three text-primary" aria-hidden />
        <span><b className="text-foreground">{stats.partners.toLocaleString('en-US')}+</b> partners earned <b className="text-emerald-600">{money(stats.paidLastMonth)}</b> last month. Your first referral is one share away.</span>
      </div>
    </section>
  );
}
