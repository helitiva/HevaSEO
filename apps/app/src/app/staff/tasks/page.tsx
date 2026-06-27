import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState, emptyKindFor } from '@/components/staff/EmptyState';
import { myTasks, BOARD_COLUMNS } from '@/data/staffMock';
import { currentStaffId } from '@/lib/currentStaff';
import { TasksClient } from './TasksClient';

export default async function MyTasksPage() {
  const board = myTasks(await currentStaffId());
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
