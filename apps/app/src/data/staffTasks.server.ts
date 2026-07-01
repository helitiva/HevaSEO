import 'server-only';
import { getPodOrders, getPodOrderById } from '@/data/orders.server';
import type { StaffTask } from '@/data/staffMock';
import { SERVICE_SKILL, qaCriteriaFor, type AdminOrder } from '@/data/adminMock';

// Lane A cleanup — the signed-in staffer's REAL assigned orders, money-blind. Reads the orders_mgr view
// (its WHERE gates a staffer to assignee_id = current_profile_id() and OMITS value), so the board never
// sees order money. Maps to the StaffTask board shape; per-order brief/keywords/notes (order_details +
// not-yet-tabled metadata) stay empty here — qa is the deterministic per-service checklist helper.
function toStaffTask(o: AdminOrder): StaffTask {
  return {
    id: o.id,
    code: o.code,
    customer: o.customer,
    service: o.service,
    pkg: o.pkg,
    status: o.status,
    priority: o.priority,
    skill: SERVICE_SKILL[o.service] ?? null,
    deadline: o.deadline,
    created: o.created,
    site: null,
    keywords: [],
    note: null,
    qa: qaCriteriaFor(o.service),
    brief: [],
  };
}

export async function getMyTasks(): Promise<StaffTask[]> {
  const orders = await getPodOrders(); // staff session → own assigned orders via orders_mgr (money-stripped)
  return orders.map(toStaffTask);
}

// A single assigned task (money-blind); null when it isn't the staffer's (the view WHERE is the gate).
export async function getMyTaskById(id: string): Promise<StaffTask | null> {
  const o = await getPodOrderById(id);
  return o ? toStaffTask(o) : null;
}
