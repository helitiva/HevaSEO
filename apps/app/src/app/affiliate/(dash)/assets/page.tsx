import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/PageHeader';
import { AssetsGrid } from '@/components/affiliate/AssetsGrid';

export const metadata: Metadata = { title: 'Marketing assets' };

export default function AssetsPage() {
  return (
    <section>
      <PageHeader
        title="Promote HevaSEO"
        subtitle="Grab ready-made banners and copy — your code is baked into every share."
      />

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-brand-500/30 bg-brand-500/[0.06] px-4 py-3 text-sm">
        <i className="ph-fill ph-trend-up text-primary" aria-hidden />
        <span>Partners who post at least once a week earn <b className="text-primary">3× more</b> on average. One share today keeps your funnel full.</span>
      </div>

      <AssetsGrid />
    </section>
  );
}
