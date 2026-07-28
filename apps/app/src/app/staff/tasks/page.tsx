import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState, emptyKindFor } from '@/components/staff/EmptyState';
import { myTasks, BOARD_COLUMNS } from '@/data/staffMock';
import { getMyTasks } from '@/data/staffTasks.server';
import { currentStaffId } from '@/lib/currentStaff';
import { TasksClient } from './TasksClient';

export const metadata = { title: 'My tasks' };

export default async function MyTasksPage() {
  // Lane A cleanup — real assigned orders (money-blind via orders_mgr) for a provisioned staff session;
  // falls back to the mock board for admin-impersonation / demo personas with no own assignments.
  const real = await getMyTasks();
  const board = real.length ? real : myTasks(await currentStaffId());
  if (board.length === 0) {
    return (
      <section>
        <PageHeader title="My Tasks" subtitle="Everything assigned to you" />
        <EmptyState kind={emptyKindFor(false)} />
      </section>
    );
  }
  return (
    <section>
      <PageHeader title="My Tasks" subtitle={`${board.length} tasks across ${BOARD_COLUMNS.length} stages`} />
      <TasksClient board={board} />
    </section>
  );
}
