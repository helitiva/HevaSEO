import { notFound } from 'next/navigation';
import { MY_TASKS, taskById, deliverablesFor, messagesFor, clientSummary, myManager, managerThread } from '@/data/staffMock';
import { daysToDue } from '@/lib/staff';
import { TaskDetailClient } from './TaskDetailClient';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = taskById(id);
  if (!task) notFound();

  const idx = MY_TASKS.findIndex((t) => t.id === id);
  const prev = idx > 0 ? MY_TASKS[idx - 1].id : null;
  const next = idx < MY_TASKS.length - 1 ? MY_TASKS[idx + 1].id : null;

  const manager = myManager();

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
    />
  );
}
