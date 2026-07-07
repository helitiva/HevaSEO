import 'server-only';
import { getPodOrders, getPodOrderById, getOrderDetail } from '@/data/orders.server';
import type { OrderDetailExtra } from '@/lib/orderDetail';
import type { StaffTask } from '@/data/staffMock';
import { SERVICE_SKILL, qaCriteriaFor, type AdminOrder } from '@/data/adminMock';

// Lane A cleanup — the signed-in staffer's REAL assigned orders, money-blind. Reads the orders_mgr view
// (its WHERE gates a staffer to assignee_id = current_profile_id() and OMITS value), so the board never
// sees order money. Maps to the StaffTask board shape. The full customer intake (brief/site/keywords) is
// pulled from order_details when we have it (task detail) — the board cards don't need it.
function toStaffTask(o: AdminOrder, detail?: OrderDetailExtra | null): StaffTask {
  const brief = detail?.brief?.map((b) => ({ label: b.label, value: b.value })) ?? [];
  const siteEntry = brief.find((b) => /website|site|url|domain/i.test(b.label));
  const kwEntry = brief.find((b) => /keyword/i.test(b.label));
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
    site: siteEntry?.value ?? null,
    keywords: kwEntry ? kwEntry.value.split(/[,\n]/).map((k) => k.trim()).filter(Boolean) : [],
    note: detail?.project ? `Project: ${detail.project}${detail.folder ? ` · ${detail.folder}` : ''}` : null,
    qa: qaCriteriaFor(o.service),
    brief,
  };
}

export async function getMyTasks(): Promise<StaffTask[]> {
  const orders = await getPodOrders(); // staff session → own assigned orders via orders_mgr (money-stripped)
  return orders.map((o) => toStaffTask(o)); // board cards don't need the full brief
}

// A single assigned task (money-blind); null when it isn't the staffer's (the view WHERE is the gate).
// Pulls the customer's intake from order_details (order_details_staff RLS) so the staffer sees the brief.
export async function getMyTaskById(id: string): Promise<StaffTask | null> {
  const o = await getPodOrderById(id);
  if (!o) return null;
  const detail = await getOrderDetail(id);
  return toStaffTask(o, detail);
}
