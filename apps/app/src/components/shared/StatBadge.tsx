import type { OrderStatus, Priority } from '@/data/adminMock';
import { statusLabel } from '@/data/adminMock';

const TONE: Record<string, string> = {
  new: 'pill-good', confirmed: 'pill-good', assigned: 'pill-good', in_progress: 'pill-warn',
  internal_review: 'pill-warn', delivered: 'pill-warn', changes_requested: 'pill-warn',
  approved: 'pill-live', completed: 'pill-live', canceled: 'pill',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`pill ${TONE[status] ?? 'pill'}`}>{statusLabel[status]}</span>;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`prio prio-${priority}`}>{priority}</span>;
}
