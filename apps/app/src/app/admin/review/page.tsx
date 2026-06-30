import { TIER } from '@/data/adminMock';
import { ReviewClient } from './ReviewClient';
import { buildReviewProps } from './build';
import { getOrders } from '@/data/orders.server';
import { getDeliverables } from '@/data/deliverables.server';
import { getStaff } from '@/data/staff.server';

export const metadata = { title: 'Review' };

export default async function ReviewPage() {
  const [orders, deliverables, staff] = await Promise.all([getOrders(), getDeliverables(), getStaff()]); // RLS-scoped
  const p = buildReviewProps(null, orders, deliverables, staff);
  return <ReviewClient queue={p.queue} sentBack={p.sentBack} staffQuality={p.staffQuality} stats={p.stats} tierMeta={TIER} />;
}
