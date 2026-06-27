import { TIER } from '@/data/adminMock';
import { ReviewClient } from './ReviewClient';
import { buildReviewProps } from './build';

export default function ReviewPage() {
  const p = buildReviewProps();
  return <ReviewClient queue={p.queue} sentBack={p.sentBack} staffQuality={p.staffQuality} stats={p.stats} tierMeta={TIER} />;
}
