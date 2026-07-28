import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/staff/EmptyState';
import { DeliverablesClient } from './DeliverablesClient';
import { myDeliverables, deliverableStats } from '@/data/staffMock';
import { currentStaffId } from '@/lib/currentStaff';

export const metadata = { title: 'Deliverables' };

export default async function DeliverablesPage() {
  const sid = await currentStaffId();
  const rows = myDeliverables(sid);

  return (
    <section>
      <PageHeader title="Deliverables" subtitle={rows.length ? `${rows.length} submissions across your tasks` : 'Everything you’ve submitted, newest first'} />
      {rows.length === 0 ? <EmptyState kind="caught-up" /> : <DeliverablesClient rows={rows} stats={deliverableStats(sid)} />}
    </section>
  );
}
