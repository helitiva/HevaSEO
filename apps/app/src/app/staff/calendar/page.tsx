import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/staff/EmptyState';
import { CalendarClient } from './CalendarClient';
import { myTasks } from '@/data/staffMock';
import { currentStaffId } from '@/lib/currentStaff';
import { TODAY } from '@/lib/staff';
import { monthOf } from '@/lib/calendar';

export default async function CalendarPage() {
  const dated = myTasks(await currentStaffId()).filter((t) => t.deadline);
  // Open on the month of the soonest deadline (fallback to today's month).
  const initialMonth = dated.length
    ? monthOf([...dated].sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))[0].deadline!)
    : monthOf(TODAY);

  const tasks = dated.map((t) => ({
    id: t.id, code: t.code, service: t.service, deadline: t.deadline!,
    status: t.status, priority: t.priority, customer: t.customer,
    start: t.created, // timeline/Gantt bar start
    pkg: t.pkg, brief: t.brief,
  }));

  return (
    <section>
      <PageHeader title="Calendar" subtitle="Your deadlines, laid out by day" />
      {tasks.length === 0 ? (
        <EmptyState kind="caught-up" />
      ) : (
        <CalendarClient tasks={tasks} initialMonth={initialMonth} today={TODAY} />
      )}
    </section>
  );
}
