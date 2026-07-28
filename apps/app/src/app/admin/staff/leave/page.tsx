import { LEAVE_REQUESTS } from '@/data/adminMock';
import { LeaveQueueClient } from './LeaveQueueClient';

export const metadata = { title: 'Leave requests' };

export default function LeaveQueuePage() {
  return <LeaveQueueClient initial={LEAVE_REQUESTS} />;
}
