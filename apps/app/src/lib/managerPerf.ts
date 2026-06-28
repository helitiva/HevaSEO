/**
 * Manager performance — the Manager Score model (and its levers), the single
 * source for "how well is a manager running their pod".
 *
 * Mirrors the staff delivery score in {@link lib/staff} (composite +
 * `scoreBreakdown` + `improvementLever`) so the whole platform reads ONE shape
 * for a performance number: a 0–100 composite, weighted levers each with a goal
 * bar, and the single weakest lever surfaced as a coaching action.
 *
 * Money-blind on purpose: like the rest of the /manager surface it reads only
 * ops signals (workload, QA, SLA, latencies) — never order value, payroll, or
 * customer spend. The same module powers the admin oversight view, where money
 * lives elsewhere; the score itself never depends on it.
 *
 * Phase-0 is a mock: latencies derive from seeded timestamps. When the DB lands,
 * swap the data reads — the returned shapes (what the pages render) don't change.
 */
import {
  MANAGERS, LEAVE_REQUESTS, ORDER_ASSIGNED_AT, SKILL_META, DELIVERABLES,
  type AdminManager,
} from '@/data/adminMock';
import { myWorkStats } from '@/data/staffMock';
import { managerScope, ordersForPod, type ManagerScope } from './managerScope';
import {
  qaHealth, slaHealth, rosterWithRebalance, ageDays,
} from './managerPulse';
import { rankByComposite, type TeamRank } from './staff';

// ---------------------------------------------------------------- score model

export type MgrLeverKey = 'delivery' | 'quality' | 'responsiveness' | 'team-health' | 'growth';

export interface MgrLeverTerm { key: MgrLeverKey; label: string; weight: number; goal: number; icon: string; }
/** Weights sum to 1. Goals are the "good" bar each lever is coached toward. */
export const MGR_SCORE_MODEL: MgrLeverTerm[] = [
  { key: 'delivery', label: 'Delivery', weight: 0.30, goal: 90, icon: 'ph-rocket-launch' },
  { key: 'quality', label: 'Quality', weight: 0.25, goal: 85, icon: 'ph-seal-check' },
  { key: 'responsiveness', label: 'Responsiveness', weight: 0.20, goal: 90, icon: 'ph-lightning' },
  { key: 'team-health', label: 'Team health', weight: 0.15, goal: 85, icon: 'ph-heartbeat' },
  { key: 'growth', label: 'People growth', weight: 0.10, goal: 60, icon: 'ph-trend-up' },
];

const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, n));
const round = (n: number): number => Math.round(n);
const avg = (ns: number[]): number => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);
/** Latency → 0–100: full score within `free` days, then `perDay` off each day beyond. */
const latencyScore = (days: number, free: number, perDay: number): number =>
  clamp(100 - Math.max(0, days - free) * perDay);

/**
 * Scoring knobs in one place — the per-day latency penalties, the healthy
 * utilization band, and the growth curve. Kept here (not inline) so the model is
 * tunable from a single spot and the intent is documented.
 */
const TUNING = {
  reviewFreeDays: 1, reviewPerDay: 35,    // review turnaround: same-day is full marks
  assignFreeDays: 1, assignPerDay: 30,    // time-to-route incoming work
  leaveFreeDays: 1, leavePerDay: 20, leavePendingPenalty: 12, // leave-decision latency + aging
  // SLA: penalise by the SHARE of urgent tickets breached (not an absolute count, so a
  // pod with 3/4 urgent breached scores far worse than 3/50), plus a small backlog ding.
  ticketBreachWeight: 70, ticketUrgentDing: 5, ticketOpenDing: 5,
  utilFloor: 60, utilCeil: 90, utilOverPenalty: 2.5,          // healthy utilization band
  // Team-health sub-weights — fairness leads, so an uneven pod can't hide behind full
  // skill coverage + a healthy headline utilization.
  teamFairnessWeight: 0.45, teamUtilWeight: 0.30, teamSkillWeight: 0.25,
  growthBaseline: 50, growthPerPoint: 4,                      // flat trend = 50, each trend-pt = +4
} as const;

// ------------------------------------------------------------- raw pod signals

/** The operating numbers the pages show verbatim, alongside the lever scores. */
export interface ManagerStats {
  teamSize: number; activeCount: number;
  // delivery
  onTimeAvg: number; overdue: number; activeLoad: number; util: number;
  // quality
  firstPassRate: number; changesRate: number; avgRating: number | null;
  // responsiveness
  reviewTurnaroundDays: number; awaitingReview: number; oldestReviewWaitDays: number;
  openTickets: number; urgentTickets: number; breachedTickets: number;
  pendingLeave: number; avgLeaveDecisionDays: number;
  avgAssignLagDays: number;
  // team health
  loadFairness: number; skillCoverage: number; skillGaps: string[];
  // growth
  growthSlope: number; improving: number; slipping: number;
}

function computeStats(scope: ManagerScope): ManagerStats {
  const active = scope.staff.filter((s) => s.active);
  const { roster } = rosterWithRebalance(scope);
  const activeRoster = roster.filter((r) => r.active);
  const qa = qaHealth(scope);
  const sla = slaHealth(scope);

  const activeLoad = activeRoster.reduce((n, r) => n + r.load, 0);
  const cap = activeRoster.reduce((n, r) => n + r.capacity, 0);
  const overdue = activeRoster.reduce((n, r) => n + r.overdue, 0);
  const podOrders = ordersForPod(scope);

  // Leave latency for this pod.
  const podLeaves = LEAVE_REQUESTS.filter((l) => scope.staffIds.has(l.staffId));
  const decided = podLeaves.filter((l) => l.decidedAt !== null);
  const avgLeaveDecisionDays = decided.length
    ? +avg(decided.map((l) => Math.max(0, ageDays(l.requestedAt, l.decidedAt!)))).toFixed(1)
    : 0;
  const pendingLeave = podLeaves.filter((l) => l.status === 'pending').length;

  // Assign latency: created → assignedAt for this pod's routed orders.
  const lags = podOrders
    .filter((o) => ORDER_ASSIGNED_AT[o.id])
    .map((o) => Math.max(0, ageDays(o.created, ORDER_ASSIGNED_AT[o.id])));
  const avgAssignLagDays = +avg(lags).toFixed(1);

  // Load fairness: spread of utilization across active members (tight spread = fair).
  const utils = activeRoster.map((r) => r.util);
  const loadFairness = utils.length <= 1 ? 100 : clamp(100 - (Math.max(...utils) - Math.min(...utils)));

  // Skill coverage: skills with at least one active staffer who holds them.
  const allSkills = Object.keys(SKILL_META);
  const skillGaps = allSkills.filter((k) => !active.some((s) => s.skills.includes(k)));
  const skillCoverage = allSkills.length ? round(((allSkills.length - skillGaps.length) / allSkills.length) * 100) : 100;

  // Quality outcome: the pod's average QA/customer rating from completed work (not the
  // staffer's stored quality field — keeps the quality lever to real outcomes).
  const ratings = active
    .map((s) => myWorkStats(s.id).avgRating)
    .filter((r): r is number => r !== null);
  const avgRating = ratings.length ? +avg(ratings).toFixed(2) : null;

  // Growth: average slope of each member's throughput trend (last − first). This is an
  // output-momentum proxy — staff have no composite history in Phase-0 (see leverScores note).
  const slopes = active
    .map((s) => (s.trend.length >= 2 ? s.trend[s.trend.length - 1] - s.trend[0] : 0));
  const growthSlope = +avg(slopes).toFixed(1);
  const improving = active.filter((s) => s.trend.length >= 2 && s.trend[s.trend.length - 1] > s.trend[0]).length;
  const slipping = active.filter((s) => s.trend.length >= 2 && s.trend[s.trend.length - 1] < s.trend[0]).length;

  return {
    teamSize: scope.staff.length,
    activeCount: active.length,
    onTimeAvg: active.length ? round(avg(active.map((s) => s.onTime))) : 0,
    overdue,
    activeLoad,
    util: cap ? round((activeLoad / cap) * 100) : 0,
    firstPassRate: qa.firstPassRate,
    changesRate: qa.changesRate,
    avgRating,
    reviewTurnaroundDays: qa.avgTurnaroundDays,
    awaitingReview: qa.awaiting,
    oldestReviewWaitDays: reviewBacklogAge(scope),
    openTickets: sla.open,
    urgentTickets: sla.urgent,
    breachedTickets: sla.breached,
    pendingLeave,
    avgLeaveDecisionDays,
    avgAssignLagDays,
    loadFairness,
    skillCoverage,
    skillGaps: skillGaps.map((k) => SKILL_META[k]?.label ?? k),
    growthSlope,
    improving,
    slipping,
  };
}

/** Days the oldest still-unreviewed pod submission has been waiting on the manager. */
function reviewBacklogAge(scope: ManagerScope): number {
  // Latest version per order, submitted by a pod member.
  const latest = new Map<string, { version: number; submittedAt: string; status: string }>();
  for (const d of DELIVERABLES) {
    if (!scope.staffNames.has(d.staff)) continue;
    const cur = latest.get(d.orderId);
    if (!cur || d.version > cur.version) latest.set(d.orderId, { version: d.version, submittedAt: d.submittedAt, status: d.status });
  }
  let max = 0;
  for (const d of latest.values()) {
    if (d.status !== 'submitted') continue;
    max = Math.max(max, Math.max(0, ageDays(d.submittedAt)));
  }
  return max;
}

// --------------------------------------------------------------- lever scoring

export interface ManagerLever {
  key: MgrLeverKey; label: string; icon: string;
  score: number;        // 0–100
  weight: number;
  goal: number;
  points: number;       // weighted contribution, reconciled to sum to composite
  headroom: number;     // composite points still gainable = (goal − score) × weight
  action: string;       // the coaching nudge for this lever
}

/** Each lever's raw 0–100 score, before reconciliation to the composite. */
function leverScores(s: ManagerStats): Record<MgrLeverKey, number> {
  // Delivery: on-time blended with an overdue penalty.
  const overduePenalty = s.activeLoad ? clamp((s.overdue / s.activeLoad) * 100) : 0;
  const delivery = clamp(avg([s.onTimeAvg, 100 - overduePenalty]));

  // Quality: first-pass approval rate blended with the pod's QA/customer rating (1–5 → 0–100).
  // Falls back to first-pass alone when no work has been rated yet.
  const ratingScore = s.avgRating !== null ? clamp(s.avgRating * 20) : s.firstPassRate;
  const quality = clamp(avg([s.firstPassRate, ratingScore]));

  // Responsiveness: how fast the manager clears the things that sit on them.
  const reviewScore = latencyScore(s.reviewTurnaroundDays, TUNING.reviewFreeDays, TUNING.reviewPerDay);
  // Ticket SLA: share of urgent tickets breached drives the penalty, so it scales with
  // load instead of cratering on a raw count. Falls back to a light ding for open backlog.
  const ticketScore = s.urgentTickets > 0
    ? clamp(100 - (s.breachedTickets / s.urgentTickets) * TUNING.ticketBreachWeight - TUNING.ticketUrgentDing)
    : clamp(100 - (s.openTickets > 0 ? TUNING.ticketOpenDing : 0));
  const leaveScore = clamp(latencyScore(s.avgLeaveDecisionDays, TUNING.leaveFreeDays, TUNING.leavePerDay) - s.pendingLeave * TUNING.leavePendingPenalty);
  const assignScore = latencyScore(s.avgAssignLagDays, TUNING.assignFreeDays, TUNING.assignPerDay);
  const responsiveness = clamp(avg([reviewScore, ticketScore, leaveScore, assignScore]));

  // Team health: even load, healthy utilization band, full skill coverage.
  const utilBand = s.util <= 0 ? 50
    : s.util < TUNING.utilFloor ? clamp((s.util / TUNING.utilFloor) * 100)
    : s.util <= TUNING.utilCeil ? 100
    : clamp(100 - (s.util - TUNING.utilCeil) * TUNING.utilOverPenalty);
  const teamHealth = clamp(
    s.loadFairness * TUNING.teamFairnessWeight +
    utilBand * TUNING.teamUtilWeight +
    s.skillCoverage * TUNING.teamSkillWeight,
  );

  // People growth: throughput momentum (flat = 50, rising climbs, falling drops).
  // NOTE: staff carry only a *throughput* trend in Phase-0, not a composite history —
  // so this is an output-momentum proxy for development, not a true score trajectory.
  const growth = clamp(TUNING.growthBaseline + s.growthSlope * TUNING.growthPerPoint);

  return { delivery, quality, responsiveness, 'team-health': teamHealth, growth };
}

/** Build the coaching action string for a lever from the live numbers. */
function actionFor(key: MgrLeverKey, s: ManagerStats): string {
  switch (key) {
    case 'delivery':
      return s.overdue > 0
        ? `${s.overdue} order${s.overdue > 1 ? 's' : ''} overdue — clear the oldest and protect the next deadlines.`
        : `On-time at ${s.onTimeAvg}% — tighten estimates on the orders due this week.`;
    case 'quality':
      return `First-pass at ${s.firstPassRate}% (${s.changesRate}% sent back) — sharpen briefs and QA before work starts to cut rework.`;
    case 'responsiveness': {
      const bits: string[] = [];
      if (s.awaitingReview > 0) bits.push(`${s.awaitingReview} submission${s.awaitingReview > 1 ? 's' : ''} waiting (oldest ${s.oldestReviewWaitDays}d)`);
      if (s.breachedTickets > 0) bits.push(`${s.breachedTickets} SLA breach${s.breachedTickets > 1 ? 'es' : ''}`);
      if (s.pendingLeave > 0) bits.push(`${s.pendingLeave} leave pending`);
      return bits.length ? `Clear what's on you: ${bits.join(', ')}.` : `Turnaround is ${s.reviewTurnaroundDays}d — keep the queue same-day.`;
    }
    case 'team-health':
      return s.util > 90
        ? `Pod at ${s.util}% utilization — rebalance from the busiest to the lightest before it slips.`
        : s.skillGaps.length
        ? `Skill gap: no active cover for ${s.skillGaps.join(', ')} — cross-train or hire.`
        : `Load fairness ${s.loadFairness}% — even out who carries what.`;
    case 'growth':
      return s.slipping > 0
        ? `${s.slipping} staffer${s.slipping > 1 ? 's' : ''} trending down on output — set a goal and check in weekly.`
        : `Team output is flat — pick one improvement per person to push this month.`;
  }
}

// ----------------------------------------------------------------- public API

export interface ManagerPerf {
  id: string; name: string; title: string; email: string;
  composite: number;
  levers: ManagerLever[];
  weakest: ManagerLever | null;   // the lever with the most composite headroom (null = all at goal)
  rank: TeamRank | null;
  trend: number[];                // synthesized score history, ending at composite
  stats: ManagerStats;
}

/** One manager's full performance picture (rank/benchmark resolved across the org). */
function perfInputs(m: AdminManager): { meta: AdminManager; composite: number; levers: ManagerLever[]; weakest: ManagerLever | null; stats: ManagerStats } {
  const scope = managerScope(m.id);
  const stats = computeStats(scope);
  const raw = leverScores(stats);

  // Weighted contributions, reconciled to sum exactly to the composite (as scoreBreakdown does).
  const contributions = MGR_SCORE_MODEL.map((t) => ({ t, score: raw[t.key], contribution: t.weight * raw[t.key] }));
  const composite = round(contributions.reduce((sum, c) => sum + c.contribution, 0));
  const rawTotal = contributions.reduce((sum, c) => sum + c.contribution, 0);
  const scale = rawTotal > 0 ? composite / rawTotal : 0;

  const levers: ManagerLever[] = contributions.map(({ t, score, contribution }) => ({
    key: t.key, label: t.label, icon: t.icon,
    score: round(score), weight: t.weight, goal: t.goal,
    points: Math.round(contribution * scale * 10) / 10,
    headroom: Math.round(Math.max(0, (t.goal - score) * t.weight) * 10) / 10,
    action: actionFor(t.key, stats),
  }));

  const weakest = levers
    .filter((l) => l.headroom > 0)
    .sort((a, b) => b.headroom - a.headroom)[0] ?? null;

  return { meta: m, composite, levers, weakest, stats };
}

/** A deterministic 8-point score history ending at the current composite. */
function synthTrend(id: string, composite: number): number[] {
  let seed = id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 9);
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const points: number[] = [];
  let v = clamp(composite - 6 - rand() * 4); // start a few points below "now"
  for (let i = 0; i < 7; i++) {
    v = clamp(v + (rand() - 0.4) * 3.2);
    points.push(round(v));
  }
  points.push(composite);
  return points;
}

/** Every manager's performance, ranked by composite. The list the admin view renders. */
export function allManagerPerf(): ManagerPerf[] {
  const inputs = MANAGERS.map(perfInputs);
  const board = inputs.map((i) => ({ id: i.meta.id, composite: i.composite }));
  return inputs.map((i) => ({
    id: i.meta.id, name: i.meta.name, title: i.meta.title, email: i.meta.email,
    composite: i.composite, levers: i.levers, weakest: i.weakest,
    rank: rankByComposite(board, i.meta.id),
    trend: synthTrend(i.meta.id, i.composite),
    stats: i.stats,
  }));
}

/** One manager (rank/benchmark resolved across the org). Null for an unknown id. */
export function buildManagerPerf(managerId: string): ManagerPerf | null {
  return allManagerPerf().find((p) => p.id === managerId) ?? null;
}

export interface CompanyBenchmark { avgComposite: number; avgByLever: Record<MgrLeverKey, number>; pods: number; }
/** The anonymized company average a manager benchmarks themselves against. */
export function companyBenchmark(perfs: ManagerPerf[] = allManagerPerf()): CompanyBenchmark {
  const avgByLever = Object.fromEntries(
    MGR_SCORE_MODEL.map((t) => [t.key, round(avg(perfs.map((p) => p.levers.find((l) => l.key === t.key)?.score ?? 0)))]),
  ) as Record<MgrLeverKey, number>;
  return { avgComposite: round(avg(perfs.map((p) => p.composite))), avgByLever, pods: perfs.length };
}
