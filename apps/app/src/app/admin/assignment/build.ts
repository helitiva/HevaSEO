import { ORDERS, STAFF, RULES, tierOf, customerByCompany, ORDER_EXTRA, MOCK_TODAY, ACTIVE_ORDER_STATUS, type Tier, type AdminStaff, type AdminOrder, type AdminRule } from '@/data/adminMock';

const factsOf = (o: AdminOrder) => {
  const c = customerByCompany(o.customer);
  const site = c?.email.split('@')[1] ?? `${o.customer.toLowerCase().replace(/\s+/g, '')}.com`;
  const ex = ORDER_EXTRA[o.id];
  return { source: o.source, site, targetUrl: `https://${site}`, project: ex?.project ?? `${o.customer} — SEO program`, folder: ex?.folder ?? 'General' };
};

const SKILL_OF: Record<string, string> = { Keyword: 'keyword', Backlink: 'backlink', Content: 'content', Optimization: 'optimize', Audit: 'optimize' };
const TODAY = new Date(`${MOCK_TODAY}T00:00:00`);
const PRI_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

function rank(service: string, pkg: string, roster: readonly AdminStaff[], rules: readonly AdminRule[]) {
  const skill = SKILL_OF[service];
  const pinRule = rules.find((r) => r.active && r.mode === 'pin' && r.service === service && (r.pkg === null || r.pkg === pkg));
  const activeRoster = roster.filter((s) => s.active);
  const pool = skill ? activeRoster.filter((s) => s.skills.includes(skill)) : activeRoster;
  const base = (pool.length ? pool : activeRoster).slice()
    .sort((a, b) => b.composite - a.composite || a.openLoad - b.openLoad);
  const ordered = pinRule ? [...base.filter((s) => s.name === pinRule.target), ...base.filter((s) => s.name !== pinRule.target)] : base;
  return {
    pinnedTo: pinRule?.target ?? null,
    candidates: ordered.map((s) => ({ name: s.name, composite: s.composite, quality: s.quality, onTime: s.onTime, openLoad: s.openLoad, capacity: s.capacity, skillMatch: skill ? s.skills.includes(skill) : false })),
  };
}

const custOf = (company: string) => {
  const c = customerByCompany(company);
  return c ? { id: c.id, name: c.name, company: c.company, email: c.email, tier: c.tier, spend: c.spend, orders: c.orders, balance: c.balance } : null;
};

// Shared by the admin Assignment board and the manager (pod-scoped) one. The
// roster is the only candidate pool: managers route from the shared unassigned
// queue but can only assign to (and see the in-flight work of) their own staff.
export function buildAssignmentProps(
  roster: readonly AdminStaff[] = STAFF,
  orders: readonly AdminOrder[] = ORDERS,
  rules: readonly AdminRule[] = RULES,
) {
  const seqMap = new Map([...orders].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const));
  const rosterNames = new Set(roster.map((s) => s.name));
  const unassigned = orders.filter((o) => o.staff === null && o.status !== 'canceled');
  const queue = unassigned.map((o) => {
    const r = rank(o.service, o.pkg, roster, rules);
    const cust = customerByCompany(o.customer);
    const tier: Tier = cust ? cust.tier : tierOf(o.value);
    const daysToDue = o.deadline ? Math.round((new Date(o.deadline).getTime() - TODAY.getTime()) / 86400000) : Number.POSITIVE_INFINITY;
    return {
      id: o.id, seq: seqMap.get(o.id) ?? 0, code: o.code, customer: o.customer, tier,
      service: o.service, pkg: o.pkg, priority: o.priority, status: o.status, value: o.value,
      deadline: o.deadline, daysToDue, created: o.created, ageDays: Math.round((TODAY.getTime() - new Date(o.created).getTime()) / 86400000),
      ...factsOf(o), cust: custOf(o.customer), suggested: r.pinnedTo ?? r.candidates[0]?.name ?? null, pinnedTo: r.pinnedTo, candidates: r.candidates,
    };
  }).sort((a, b) => (PRI_RANK[a.priority] - PRI_RANK[b.priority]) || a.daysToDue - b.daysToDue);

  // Current in-flight work per staff (their real workload, for the board + rebalance).
  const assigned = orders.filter((o) => o.staff && rosterNames.has(o.staff) && ACTIVE_ORDER_STATUS.has(o.status)).map((o) => {
    const cust = customerByCompany(o.customer);
    const tier: Tier = cust ? cust.tier : tierOf(o.value);
    const daysToDue = o.deadline ? Math.round((new Date(o.deadline).getTime() - TODAY.getTime()) / 86400000) : 9999;
    return { id: o.id, code: o.code, service: o.service, pkg: o.pkg, priority: o.priority, status: o.status, customer: o.customer, tier, value: o.value, deadline: o.deadline, daysToDue, ...factsOf(o), cust: custOf(o.customer), home: o.staff as string };
  });

  const staff = roster.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, skills: s.skills, capacity: s.capacity, openLoad: assigned.filter((a) => a.home === s.name).length, composite: s.composite, quality: s.quality, onTime: s.onTime, throughput: s.throughput }));
  const ruleVMs = rules.map((r) => ({ id: r.id, service: r.service, pkg: r.pkg, mode: r.mode, target: r.target, priority: r.priority, active: r.active }));

  const totalCap = staff.reduce((s, x) => s + x.capacity, 0);
  const totalLoad = staff.reduce((s, x) => s + x.openLoad, 0);
  const kpis = {
    unassigned: queue.length,
    overdueRisk: queue.filter((q) => q.daysToDue <= 1).length,
    autoRoutablePct: queue.length ? Math.round((queue.filter((q) => q.suggested).length / queue.length) * 100) : 100,
    utilizationPct: totalCap ? Math.round((totalLoad / totalCap) * 100) : 0,
    throughput: staff.reduce((s, x) => s + x.throughput, 0),
  };

  return { queue, assigned, staff, rules: ruleVMs, kpis };
}
