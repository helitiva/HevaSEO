import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewClient } from '@/app/admin/review/ReviewClient';
import { buildReviewProps } from '@/app/admin/review/build';
import { TIER } from '@/data/adminMock';
import { getPodOrders, getOrderDetailsByIds } from '@/data/orders.server';
import { getDeliverables } from '@/data/deliverables.server';
import { getStaff } from '@/data/staff.server';

export const metadata = { title: 'Review' };

// Manager Review — the REAL QA board for this pod: deliverables + orders are RLS-scoped to the manager's
// pod (money-blind via orders_mgr; deliverables_manager_pod policy). review_deliverable + advance_order
// permit pod-scoped manager review. (Previously this rendered mock data.)
export default async function ManagerReviewPage() {
  const [orders, deliverables, staff] = await Promise.all([getPodOrders(), getDeliverables(), getStaff()]);
  const details = await getOrderDetailsByIds(orders.map((o) => o.id));
  const p = buildReviewProps(null, orders, deliverables, staff, details);
  return (
    <section className="space-y-4">
      <PageHeader title="Review" subtitle="Deliverables awaiting QA in your pod" />
      <ReviewClient queue={p.queue} sentBack={p.sentBack} staffQuality={p.staffQuality} stats={p.stats} tierMeta={TIER} />
    </section>
  );
}
