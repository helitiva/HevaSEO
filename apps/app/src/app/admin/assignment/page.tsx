import { ORDERS, STAFF, RULES, TIER, tierOf, customerByCompany, type Tier } from '@/data/adminMock';
import { AssignmentClient } from './AssignmentClient';

const SKILL_OF: Record<string, string> = { Keyword: 'keyword', Backlink: 'backlink', Content: 'content', Optimization: 'optimize', Audit: 'optimize' };
const seqMap = new Map([...ORDERS].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const));
const TODAY = new Date('2026-06-24T00:00:00');
const PRI_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

function rank(service: string, pkg: string) {
  const skill = SKILL_OF[service];
  const pinRule = RULES.find((r) => r.active && r.mode === 'pin' && r.service === service && (r.pkg === null || r.pkg === pkg));
  const pool = skill ? STAFF.filter((s) => s.active && s.skills.includes(skill)) : STAFF.filter((s) => s.active);
  const base = (pool.length ? pool : STAFF.filter((s) => s.active)).slice()
    .sort((a, b) => b.composite - a.composite || a.openLoad - b.openLoad);
  const ordered = pinRule ? [...base.filter((s) => s.name === pinRule.target), ...base.filter((s) => s.name !== pinRule.target)] : base;
  return {
    pinnedTo: pinRule?.target ?? null,
    candidates: ordered.map((s) => ({ name: s.name, composite: s.composite, quality: s.quality, onTime: s.onTime, openLoad: s.openLoad, capacity: s.capacity, skillMatch: skill ? s.skills.includes(skill) : false })),
  };
}

export default function AssignmentPage() {
  const unassigned = ORDERS.filter((o) => o.staff === null && o.status !== 'canceled');
  const queue = unassigned.map((o) => {
    const r = rank(o.service, o.pkg);
    const cust = customerByCompany(o.customer);
    const tier: Tier = cust ? cust.tier : tierOf(o.value);
    const daysToDue = o.deadline ? Math.round((new Date(o.deadline).getTime() - TODAY.getTime()) / 86400000) : Number.POSITIVE_INFINITY;
    return {
      id: o.id, seq: seqMap.get(o.id) ?? 0, code: o.code, customer: o.customer, tier,
      service: o.service, pkg: o.pkg, priority: o.priority, status: o.status, value: o.value,
      deadline: o.deadline, daysToDue, suggested: r.pinnedTo ?? r.candidates[0]?.name ?? null,
      pinnedTo: r.pinnedTo, candidates: r.candidates,
    };
  }).sort((a, b) => (PRI_RANK[a.priority] - PRI_RANK[b.priority]) || a.daysToDue - b.daysToDue);

  const staff = STAFF.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, skills: s.skills, capacity: s.capacity, openLoad: s.openLoad, composite: s.composite, quality: s.quality, onTime: s.onTime, throughput: s.throughput }));
  const rules = RULES.map((r) => ({ id: r.id, service: r.service, pkg: r.pkg, mode: r.mode, target: r.target, priority: r.priority, active: r.active }));

  const totalCap = staff.reduce((s, x) => s + x.capacity, 0);
  const totalLoad = staff.reduce((s, x) => s + x.openLoad, 0);
  const kpis = {
    unassigned: queue.length,
    overdueRisk: queue.filter((q) => q.daysToDue <= 1).length,
    autoRoutablePct: queue.length ? Math.round((queue.filter((q) => q.suggested).length / queue.length) * 100) : 100,
    utilizationPct: totalCap ? Math.round((totalLoad / totalCap) * 100) : 0,
    throughput: staff.reduce((s, x) => s + x.throughput, 0),
  };

  return <AssignmentClient queue={queue} staff={staff} rules={rules} kpis={kpis} tierMeta={TIER} />;
}
