import { LEAVE_REQUESTS } from '@/data/adminMock';
import { LeaveQueueClient } from './LeaveQueueClient';

export default function LeaveQueuePage() {
  return <LeaveQueueClient initial={LEAVE_REQUESTS} />;
}
