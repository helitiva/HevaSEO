import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/staff/EmptyState';
import { DeliverablesClient } from './DeliverablesClient';
import { myDeliverables, deliverableStats } from '@/data/staffMock';

export default function DeliverablesPage() {
  const rows = myDeliverables();

  return (
    <section>
      <PageHeader title="Deliverables" subtitle={rows.length ? `${rows.length} submissions across your tasks` : 'Everything you’ve submitted, newest first'} />
      {rows.length === 0 ? <EmptyState kind="caught-up" /> : <DeliverablesClient rows={rows} stats={deliverableStats()} />}
    </section>
  );
}
