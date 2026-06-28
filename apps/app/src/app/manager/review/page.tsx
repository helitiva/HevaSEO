import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewClient } from '@/app/admin/review/ReviewClient';
import { buildReviewProps } from '@/app/admin/review/build';
import { TIER } from '@/data/adminMock';
import { managerScope, MANAGER_PERSONA } from '@/lib/managerScope';

export const metadata = { title: 'Review' };

// Manager Review — the same QA board, scoped to deliverables submitted by this
// pod's staff. Money-blind (customer LTV/credit + order value hidden).
export default function ManagerReviewPage() {
  const scope = managerScope(MANAGER_PERSONA);
  const p = buildReviewProps(scope.staffNames);
  return (
    <section className="space-y-4">
      <PageHeader title="Review" subtitle="Deliverables awaiting QA in your pod" />
      <ReviewClient queue={p.queue} sentBack={p.sentBack} staffQuality={p.staffQuality} stats={p.stats} tierMeta={TIER} />
    </section>
  );
}
