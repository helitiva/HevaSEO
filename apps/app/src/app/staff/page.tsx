import { MyDayClient } from '@/components/staff/MyDayClient';
import { MY_TASKS, CURRENT_STAFF } from '@/data/staffMock';
import { STAFF } from '@/data/adminMock';
import { daysToDue, PRIORITY_RANK } from '@/lib/staff';
import type { MyDayTask } from '@/lib/myDay';

const ACTIONABLE = new Set(['assigned', 'in_progress', 'changes_requested']);
const CAPACITY = STAFF.find((s) => s.id === CURRENT_STAFF.id)?.capacity ?? 6;

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function MyDayPage() {
  const focus: MyDayTask[] = MY_TASKS
    .filter((t) => ACTIONABLE.has(t.status))
    .map((t) => ({ id: t.id, code: t.code, service: t.service, pkg: t.pkg, status: t.status, priority: t.priority, days: daysToDue(t.deadline) }))
    .sort((a, b) => (a.days ?? 99) - (b.days ?? 99) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const firstName = CURRENT_STAFF.name.split(' ')[0];

  return (
    <MyDayClient
      greeting={`${greeting(new Date().getHours())}, ${firstName}`}
      capacity={CAPACITY}
      everHadTasks={MY_TASKS.length > 0}
      initialFocus={focus}
    />
  );
}
