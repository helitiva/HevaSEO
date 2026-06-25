import { ORDERS, DELIVERABLES, STAFF, TIER, tierOf, customerByCompany, qaCriteriaFor, type Tier } from '@/data/adminMock';
import { ReviewClient } from './ReviewClient';

const TODAY = new Date('2026-06-25T00:00:00');
const days = (a: string, b: Date) => Math.round((b.getTime() - new Date(a).getTime()) / 86400000);
const PRI_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

const custOf = (company: string) => {
  const c = customerByCompany(company);
  return c ? { id: c.id, name: c.name, company: c.company, email: c.email, tier: c.tier, spend: c.spend, orders: c.orders, balance: c.balance } : null;
};
const versionsOf = (orderId: string) => DELIVERABLES.filter((d) => d.orderId === orderId).sort((a, b) => b.version - a.version);

export default function ReviewPage() {
  // Queue = orders whose latest deliverable is awaiting the admin (status 'submitted').
  const queue = ORDERS
    .map((o) => ({ o, versions: versionsOf(o.id) }))
    .filter(({ versions }) => versions[0]?.status === 'submitted')
    .map(({ o, versions }) => {
      const latest = versions[0];
      const cust = customerByCompany(o.customer);
      const tier: Tier = cust ? cust.tier : tierOf(o.value);
      return {
        id: o.id, code: o.code, service: o.service, pkg: o.pkg, priority: o.priority, status: o.status,
        value: o.value, deadline: o.deadline, customer: o.customer, tier, cust: custOf(o.customer), staff: o.staff,
        versions, latest, isResubmission: versions.length > 1 || versions.some((v) => v.status === 'changes_requested'),
        ageDays: days(latest.submittedAt, TODAY), criteria: qaCriteriaFor(o.service),
      };
    })
    .sort((a, b) => (PRI_RANK[a.priority] - PRI_RANK[b.priority]) || b.ageDays - a.ageDays);

  // Sent back — awaiting staff re-submission (read-only context).
  const sentBack = ORDERS.map((o) => ({ o, v: versionsOf(o.id)[0] }))
    .filter(({ v }) => v?.status === 'changes_requested')
    .map(({ o, v }) => ({ id: o.id, code: o.code, service: o.service, staff: o.staff, reviewNote: v.reviewNote, ageDays: days(v.reviewedAt ?? v.submittedAt, TODAY) }));

  // Quality signal per staff: change-request rate across all their reviewed deliverables.
  const reviewed = DELIVERABLES.filter((d) => d.status !== 'submitted');
  const staffQuality = STAFF.filter((s) => s.active).map((s) => {
    const mine = reviewed.filter((d) => d.staff === s.name);
    const cr = mine.filter((d) => d.status === 'changes_requested').length;
    return { name: s.name, reviewed: mine.length, changeRate: mine.length ? Math.round((cr / mine.length) * 100) : 0 };
  }).filter((s) => s.reviewed > 0).sort((a, b) => b.changeRate - a.changeRate);

  // First-pass approval rate + avg turnaround from the closed set.
  const approvedOrders = [...new Set(DELIVERABLES.filter((d) => d.status === 'approved').map((d) => d.orderId))];
  const firstPass = approvedOrders.filter((oid) => !DELIVERABLES.some((d) => d.orderId === oid && d.status === 'changes_requested')).length;
  const turn = reviewed.filter((d) => d.reviewedAt).map((d) => days(d.submittedAt, new Date(d.reviewedAt as string)));
  const stats = {
    awaiting: queue.length,
    resubmissions: queue.filter((q) => q.isResubmission).length,
    overdue: queue.filter((q) => q.ageDays >= 2).length,
    firstPassPct: approvedOrders.length ? Math.round((firstPass / approvedOrders.length) * 100) : 100,
    avgTurnaround: turn.length ? Math.round((turn.reduce((s, x) => s + x, 0) / turn.length) * 10) / 10 : 0,
  };

  return <ReviewClient queue={queue} sentBack={sentBack} staffQuality={staffQuality} stats={stats} tierMeta={TIER} />;
}
