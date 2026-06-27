import { notFound } from 'next/navigation';
import { myTasks, taskById, deliverablesFor, messagesFor, clientSummary, myManager, managerThread, selfNotesFor } from '@/data/staffMock';
import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';
import { daysToDue } from '@/lib/staff';
import { TaskDetailClient } from './TaskDetailClient';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = await currentStaffId();
  const task = taskById(id, sid);
  if (!task) notFound();

  const board = myTasks(sid);
  const idx = board.findIndex((t) => t.id === id);
  const prev = idx > 0 ? board[idx - 1].id : null;
  const next = idx >= 0 && idx < board.length - 1 ? board[idx + 1].id : null;

  const manager = myManager(sid);

  return (
    <TaskDetailClient
      task={task}
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
