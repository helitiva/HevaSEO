import { notFound } from 'next/navigation';
import { myTasks, taskById, deliverablesFor, messagesFor, clientSummary, myManager, managerThread, selfNotesFor, type ClientSummary, type StaffTask } from '@/data/staffMock';
import { getMyTasks, getMyTaskById } from '@/data/staffTasks.server';
import { getOrderDeliverables } from '@/data/deliverables.server';
import { getOrderMessages } from '@/data/orderMessages.server';
import { getMyManagerThread } from '@/data/staffThread.server';
import { postManagerChatAction } from './managerChat.actions';
import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';
import { daysToDue } from '@/lib/staff';
import { TaskDetailClient } from './TaskDetailClient';

export const metadata = { title: 'Task detail' };

// The client card for a REAL task, built from the staffer's own visible orders (orders_mgr) for this
// customer — a staffer can't read the customers CRM table (RLS), so tier/since/tags stay blank; what they
// legitimately see is how many orders for this client are on their board and the service mix.
function realClientSummary(customer: string, board: StaffTask[]): ClientSummary {
  const mine = board.filter((t) => t.customer === customer);
  const counts = new Map<string, number>();
  mine.forEach((t) => counts.set(t.service, (counts.get(t.service) ?? 0) + 1));
  const byService = [...counts.entries()].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count);
  return {
    company: customer, tier: null, since: null, tags: [],
    orders: mine.length, byService, topService: byService[0]?.service ?? null, staff: [], note: null,
  };
}

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
  // Real deliverable versions for this order (RLS-scoped to the assignee) — was mock (empty for real ids),
  // so staff saw no file/link. Mock fallback for impersonation/demo tasks.
  const deliverables = real ? await getOrderDeliverables(id) : deliverablesFor(id);
  // inc-E29 — real order thread when this is a real assigned order; mock otherwise.
  const messages = real ? await getOrderMessages(id) : messagesFor(id);
  // real private manager↔staff thread (staff_manager_messages) for a real task; mock otherwise
  const managerMessages = real ? await getMyManagerThread() : managerThread(manager.id);

  return (
    <TaskDetailClient
      task={task}
      real={real}
      deliverables={deliverables}
      messages={messages}
      days={daysToDue(task.deadline)}
      prevId={prev}
      nextId={next}
      client={real ? realClientSummary(task.customer, board) : clientSummary(task.customer)}
      manager={manager}
      managerMessages={managerMessages}
      onManagerSend={real ? postManagerChatAction : undefined}
      selfNotes={selfNotesFor(id)}
      authorName={STAFF.find((x) => x.id === sid)?.name}
    />
  );
}
