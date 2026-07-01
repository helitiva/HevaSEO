import { notFound } from 'next/navigation';
import { myTasks, taskById, deliverablesFor, messagesFor, clientSummary, myManager, managerThread, selfNotesFor } from '@/data/staffMock';
import { getMyTasks, getMyTaskById } from '@/data/staffTasks.server';
import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';
import { daysToDue } from '@/lib/staff';
import { TaskDetailClient } from './TaskDetailClient';

export const metadata = { title: 'Task detail' };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = await currentStaffId();
  // Lane A cleanup — real assigned order (money-blind) → transitions call advance_order; falls back to
  // the mock task for impersonation/demo. Collab panels (deliverables/messages/manager) stay mock —
  // empty for real ids until those companion tables land.
  const realTask = await getMyTaskById(id);
  const task = realTask ?? taskById(id, sid);
  if (!task) notFound();
  const real = Boolean(realTask);

  const board = real ? await getMyTasks() : myTasks(sid);
  const idx = board.findIndex((t) => t.id === id);
  const prev = idx > 0 ? board[idx - 1].id : null;
  const next = idx >= 0 && idx < board.length - 1 ? board[idx + 1].id : null;

  const manager = myManager(sid);

  return (
    <TaskDetailClient
      task={task}
      real={real}
      deliverables={deliverablesFor(id)}
      messages={messagesFor(id)}
      days={daysToDue(task.deadline)}
      prevId={prev}
      nextId={next}
      client={clientSummary(task.customer)}
      manager={manager}
      managerMessages={managerThread(manager.id)}
      selfNotes={selfNotesFor(id)}
      authorName={STAFF.find((x) => x.id === sid)?.name}
    />
  );
}
