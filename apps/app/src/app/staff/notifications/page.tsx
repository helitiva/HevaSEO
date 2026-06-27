import { PageHeader } from '@/components/shared/PageHeader';
import { NotificationsClient } from './NotificationsClient';
import { STAFF_NOTIFICATIONS } from '@/data/staffMock';

export default function NotificationsPage() {
  return (
    <section>
      <PageHeader title="Notifications" subtitle="Assignments, reviews, reminders, bonuses and penalties — grouped by day" />
      <NotificationsClient initial={STAFF_NOTIFICATIONS} />
    </section>
  );
}
