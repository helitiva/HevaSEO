// Pure staff-surface logic. No money, no React — unit-tested in staff.test.ts.
import type { OrderStatus, Priority } from '@/data/adminMock';

// Mock "now". Real backend uses the request clock.
export const TODAY = '2026-06-26';

export function daysToDue(deadline: string | null, today = TODAY): number | null {
  if (!deadline) return null;
  const a = Date.parse(`${deadline}T00:00:00`);
  const b = Date.parse(`${today}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

export type SlaTone = 'bad' | 'warn' | 'soft' | 'neutral';
export interface Sla { label: string; tone: SlaTone; }

// SLA urgency chip. Color is never the only signal — the label carries the state.
export function slaChip(d: number | null): Sla | null {
  if (d === null) return null;
  if (d < 0) return { label: `Overdue ${-d}d`, tone: 'bad' };
  if (d === 0) return { label: 'Due today', tone: 'warn' };
  if (d <= 2) return { label: `Due in ${d}d`, tone: 'soft' };
  return { label: `Due in ${d}d`, tone: 'neutral' };
}

export interface StaffAction { label: string; to: OrderStatus; icon: string; primary?: boolean; }

// The ONLY transitions a staff member may trigger. Never Approve / Deliver / Cancel / reassign.
export function nextStaffActions(status: OrderStatus): StaffAction[] {
  switch (status) {
    case 'assigned':
      return [{ label: 'Start', to: 'in_progress', icon: 'ph-play', primary: true }];
    case 'in_progress':
      return [{ label: 'Submit for review', to: 'internal_review', icon: 'ph-paper-plane-tilt', primary: true }];
    case 'changes_requested':
      return [{ label: 'Resume', to: 'in_progress', icon: 'ph-arrow-counter-clockwise', primary: true }];
    default:
      return [];
  }
}

// Next version number for a resubmission. v1 on first submit, then +1 each round.
export function bumpVersion(subs: { version: number }[]): number {
  return subs.length ? Math.max(...subs.map((s) => s.version)) + 1 : 1;
}

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

// ---- Staff delivery score model (one source of truth) ----
// The staff-facing composite blends the three things a staffer actually controls. Weights live
// here so the breakdown card, the lever recommendation, and the tests all read ONE definition —
// no more a card hard-coding "45%" while the recommendation logic ignores it.
export type ScoreKey = 'quality' | 'on-time' | 'throughput';

export interface ScoreModelTerm { key: ScoreKey; label: string; weight: number; }
export const SCORE_MODEL: ScoreModelTerm[] = [
  { key: 'quality', label: 'Quality', weight: 0.45 },
  { key: 'on-time', label: 'On-time', weight: 0.35 },
  { key: 'throughput', label: 'Throughput', weight: 0.2 },
];

// Per-lever "good" bar. Quality caps below 100 because some rework is normal; throughput has no
// coaching goal — it's volume context, not a target to push (see `improvementLever`).
export const QUALITY_GOAL = 95;
export const ON_TIME_GOAL = 90;
// Tasks / 30d that read as a full-100 throughput score; above it caps so raw speed can't dominate.
export const THROUGHPUT_TARGET = 45;
const GOAL: Record<ScoreKey, number | null> = { quality: QUALITY_GOAL, 'on-time': ON_TIME_GOAL, throughput: null };

export interface ScoreInputs { quality: number; onTime: number; throughput: number; }

export const throughputPct = (throughput: number): number =>
  Math.min(100, Math.max(0, Math.round((throughput / THROUGHPUT_TARGET) * 100)));

// Each lever normalised to 0–100, keyed by model key.
export function leverScores(s: ScoreInputs): Record<ScoreKey, number> {
  return { quality: s.quality, 'on-time': s.onTime, throughput: throughputPct(s.throughput) };
}

// Composite from the weighted blend. The mock's stored `composite` is hand-authored and may differ
// by a point; `scoreBreakdown` reconciles its segments to whatever composite you hand it, so the
// bar on the page always sums to the number shown above it.
export function modelComposite(s: ScoreInputs): number {
  const v = leverScores(s);
  return Math.round(SCORE_MODEL.reduce((sum, t) => sum + t.weight * v[t.key], 0));
}

export interface ScoreSegment {
  key: ScoreKey; label: string; score: number; weight: number;
  points: number;       // weighted contribution, reconciled so segments sum to `composite`
  goal: number | null;  // null for throughput
  headroom: number;     // composite points still gainable here = (goal − score) × weight (0 if no goal)
  actionable: boolean;  // quality/on-time only — a coachable lever
}
export interface ScoreBreakdown { composite: number; segments: ScoreSegment[]; spent: number; headroom: number; }

// Decomposes a composite into its weighted parts + remaining headroom per lever. Segments are
// scaled to sum exactly to the passed `composite` so the stacked bar reconciles to the headline.
export function scoreBreakdown(s: ScoreInputs, composite: number): ScoreBreakdown {
  const v = leverScores(s);
  const raw = SCORE_MODEL.map((t) => ({ t, contribution: t.weight * v[t.key] }));
  const rawTotal = raw.reduce((sum, r) => sum + r.contribution, 0);
  const scale = rawTotal > 0 ? composite / rawTotal : 0;
  const segments: ScoreSegment[] = raw.map(({ t, contribution }) => {
    const goal = GOAL[t.key];
    const score = v[t.key];
    return {
      key: t.key, label: t.label, score, weight: t.weight,
      points: Math.round(contribution * scale * 10) / 10,
      goal,
      headroom: goal !== null ? Math.round(Math.max(0, (goal - score) * t.weight) * 10) / 10 : 0,
      actionable: goal !== null,
    };
  });
  const headroom = Math.round(segments.reduce((sum, seg) => sum + seg.headroom, 0) * 10) / 10;
  return { composite, segments, spent: composite, headroom };
}

// ---- Improvement lever: the one coachable metric most worth moving this period ----
// = the actionable lever (quality or on-time — never raw throughput, since "just do more" trades
// off the very quality the score rewards) with the most COMPOSITE headroom, where headroom =
// (goal − score) × weight. Weight-aware, so it agrees with the breakdown bar. Null when both are
// at/above goal.
export type LeverKey = 'on-time' | 'quality';
export interface Lever { key: LeverKey; score: number; gap: number; headroom: number; }

export function improvementLever(stats: { quality: number; onTime: number }): Lever | null {
  const weightOf = (k: ScoreKey): number => SCORE_MODEL.find((t) => t.key === k)?.weight ?? 0;
  const candidates: Lever[] = [
    { key: 'on-time' as const, score: stats.onTime, goal: ON_TIME_GOAL, weight: weightOf('on-time') },
    { key: 'quality' as const, score: stats.quality, goal: QUALITY_GOAL, weight: weightOf('quality') },
  ]
    .map((c) => ({
      key: c.key,
      score: c.score,
      gap: c.goal - c.score,
      headroom: Math.round((c.goal - c.score) * c.weight * 10) / 10,
    }))
    .filter((c) => c.gap > 0);
  if (candidates.length === 0) return null; // both at/above goal — nothing to nudge
  return candidates.sort((a, b) => b.headroom - a.headroom)[0];
}

export interface TeamRank { rank: number; total: number; aheadOf: number; topPercent: number; }

// Where the staffer sits among peers by composite (performance, NOT pay). Ties broken by id
// for a stable order. `topPercent` = "top N%" (1 = best). `aheadOf` = teammates below them.
export function rankByComposite(team: { id: string; composite: number }[], id: string): TeamRank | null {
  const total = team.length;
  if (total === 0) return null;
  const sorted = [...team].sort((a, b) => b.composite - a.composite || a.id.localeCompare(b.id));
  const idx = sorted.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  return {
    rank: idx + 1,
    total,
    aheadOf: total - (idx + 1),
    topPercent: Math.max(1, Math.round(((idx + 1) / total) * 100)),
  };
}

// ---- Track record: a staffer's completed-work archive → aggregate quality stats ----
// One finished task. Carries the staffer's OWN commission (their pay) but never the order value or
// customer price — commission is a flat per-task figure, not value × rate, so it can't be inverted
// back into what the customer paid.
export interface WorkItem {
  code: string; service: string; pkg: string; customer: string;
  completedAt: string;       // YYYY-MM-DD
  versions: number;          // total submissions for the task (1 = first-pass)
  revisions: number;         // rounds sent back for changes (= versions − 1 when all bounced)
  onTime: boolean;           // delivered on/before its deadline
  rating: number | null;     // admin manual rating 1–5 (null = not rated)
  days: number;              // turnaround: start → delivery, in days
  reviewNote: string | null; // why it was sent back (only set when revisions > 0)
  commission: number;        // USD the staffer earned on this task (own pay)
}

// ---- Commission tier: the staffer's per-task commission band, set by performance ----
// Higher composite → higher tier → bigger per-task commission. Managers bump a staffer up as they
// prove out. `mult` is the relative size vs the Starter band (shown to staff); we never expose a
// "% of order value", so the customer price stays hidden.
export interface CommissionTier { level: string; minComposite: number; mult: number; }
export const COMMISSION_TIERS: CommissionTier[] = [
  { level: 'Starter', minComposite: 0, mult: 1.0 },
  { level: 'Standard', minComposite: 75, mult: 1.25 },
  { level: 'Senior', minComposite: 85, mult: 1.5 },
  { level: 'Lead', minComposite: 92, mult: 1.75 },
];
export interface TierStanding { current: CommissionTier; next: CommissionTier | null; toNext: number; }
export function commissionTierFor(composite: number): TierStanding {
  const sorted = [...COMMISSION_TIERS].sort((a, b) => a.minComposite - b.minComposite);
  let current = sorted[0];
  for (const t of sorted) if (composite >= t.minComposite) current = t;
  const next = sorted.find((t) => t.minComposite > composite) ?? null;
  return { current, next, toNext: next ? next.minComposite - composite : 0 };
}

export interface ServiceStat {
  service: string; count: number; pct: number;
  avgRating: number | null; revisionRate: number; onTimeRate: number;
}

export interface WorkStats {
  total: number;
  byService: ServiceStat[];
  // revisions
  totalRevisionRounds: number;
  tasksWithRevision: number;
  revisionRate: number;   // % of tasks that needed ≥1 revision
  avgRevisions: number;   // rounds per task
  firstPassRate: number;  // % delivered with zero revisions
  // ratings
  rated: number;
  avgRating: number | null;
  ratingDist: Record<number, number>; // 1..5 → count
  bestRating: number | null;
  worstRating: number | null;
  // timeliness
  onTimeCount: number;
  onTimeRate: number;
  avgTurnaround: number | null; // days
  // strongest service (highest avg rating, ≥2 tasks to be meaningful)
  topService: string | null;
  // commission (own pay) earned across the whole archive
  totalCommission: number;
  avgCommission: number | null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const pct = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 100) : 0);
const avgOrNull = (vals: number[]): number | null => (vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null);

// One pass over the archive → every aggregate the page shows. Pure; unit-tested.
export function workStats(items: WorkItem[]): WorkStats {
  const total = items.length;
  const ratings = items.map((i) => i.rating).filter((r): r is number => r !== null);
  const tasksWithRevision = items.filter((i) => i.revisions > 0).length;
  const totalRevisionRounds = items.reduce((a, i) => a + i.revisions, 0);
  const onTimeCount = items.filter((i) => i.onTime).length;

  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) ratingDist[r] = (ratingDist[r] ?? 0) + 1;

  // group by service
  const services = [...new Set(items.map((i) => i.service))];
  const byService: ServiceStat[] = services
    .map((service) => {
      const rows = items.filter((i) => i.service === service);
      return {
        service,
        count: rows.length,
        pct: pct(rows.length, total),
        avgRating: avgOrNull(rows.map((r) => r.rating).filter((r): r is number => r !== null)),
        revisionRate: pct(rows.filter((r) => r.revisions > 0).length, rows.length),
        onTimeRate: pct(rows.filter((r) => r.onTime).length, rows.length),
      };
    })
    .sort((a, b) => b.count - a.count);

  const ratedServices = byService.filter((s) => s.count >= 2 && s.avgRating !== null);
  const topService = ratedServices.length
    ? ratedServices.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0].service
    : null;

  return {
    total,
    byService,
    totalRevisionRounds,
    tasksWithRevision,
    revisionRate: pct(tasksWithRevision, total),
    avgRevisions: total ? round1(totalRevisionRounds / total) : 0,
    firstPassRate: pct(total - tasksWithRevision, total),
    rated: ratings.length,
    avgRating: avgOrNull(ratings),
    ratingDist,
    bestRating: ratings.length ? Math.max(...ratings) : null,
    worstRating: ratings.length ? Math.min(...ratings) : null,
    onTimeCount,
    onTimeRate: pct(onTimeCount, total),
    avgTurnaround: avgOrNull(items.map((i) => i.days)),
    topService,
    totalCommission: items.reduce((a, i) => a + i.commission, 0),
    avgCommission: total ? Math.round(items.reduce((a, i) => a + i.commission, 0) / total) : null,
  };
}

// ---- Earnings history: monthly pay series → summary ----
export interface MonthEarning {
  month: string; label: string;            // '2026-06' · 'Jun'
  base: number; commission: number; bonus: number; takeHome: number;
  tasks: number;                           // tasks completed that month (commission driver)
}
export interface EarningsSummary {
  ytd: number; avg: number; momPct: number | null;
  best: MonthEarning | null; totalCommission: number; totalBonus: number;
}

// Summarises a chronological (oldest→newest) earnings series.
export function summariseEarnings(history: MonthEarning[]): EarningsSummary {
  if (history.length === 0) return { ytd: 0, avg: 0, momPct: null, best: null, totalCommission: 0, totalBonus: 0 };
  const ytd = history.reduce((a, m) => a + m.takeHome, 0);
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const momPct = prev && prev.takeHome > 0 ? round1(((last.takeHome - prev.takeHome) / prev.takeHome) * 100) : null;
  const best = history.reduce((top, m) => (m.takeHome > top.takeHome ? m : top), history[0]);
  return {
    ytd,
    avg: Math.round(ytd / history.length),
    momPct,
    best,
    totalCommission: history.reduce((a, m) => a + m.commission, 0),
    totalBonus: history.reduce((a, m) => a + m.bonus, 0),
  };
}

// ---- Rating trend: average admin rating per month (oldest → newest) ----
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export interface RatingPoint { month: string; label: string; avg: number | null; count: number; }
export function ratingTrend(items: WorkItem[]): RatingPoint[] {
  const byMonth = new Map<string, number[]>();
  for (const i of items) {
    if (i.rating === null) continue;
    const ym = i.completedAt.slice(0, 7);
    byMonth.set(ym, [...(byMonth.get(ym) ?? []), i.rating]);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, vals]) => ({
      month,
      label: MONTH_SHORT[Number(month.slice(5, 7)) - 1],
      avg: round1(vals.reduce((s, v) => s + v, 0) / vals.length),
      count: vals.length,
    }));
}

// ---- First-pass streak: consecutive zero-revision deliveries (current run + best ever) ----
export interface Streak { current: number; best: number; }
export function firstPassStreak(items: WorkItem[]): Streak {
  const ordered = [...items].sort((a, b) => b.completedAt.localeCompare(a.completedAt)); // newest first
  let current = 0;
  for (const i of ordered) { if (i.revisions === 0) current++; else break; }
  let best = 0;
  let run = 0;
  for (const i of ordered) {
    if (i.revisions === 0) { run++; best = Math.max(best, run); } else { run = 0; }
  }
  return { current, best };
}

// ---- Tasks per customer (track record by client) ----
export interface CustomerWork { customer: string; count: number; avgRating: number | null; }
export function tasksByCustomer(items: WorkItem[]): CustomerWork[] {
  const names = [...new Set(items.map((i) => i.customer))];
  return names
    .map((customer) => {
      const rows = items.filter((i) => i.customer === customer);
      return { customer, count: rows.length, avgRating: avgOrNull(rows.map((r) => r.rating).filter((r): r is number => r !== null)) };
    })
    .sort((a, b) => b.count - a.count || a.customer.localeCompare(b.customer));
}

// ---- Revision reasons: categorise the review notes on bounced tasks ----
const REVISION_CATEGORIES: { key: string; label: string; test: RegExp }[] = [
  { key: 'meta', label: 'Internal links / meta', test: /internal link|meta|title|description/i },
  { key: 'tone', label: 'Tone / brand fit', test: /tone|brand|intro|voice|style|off-brand/i },
  { key: 'anchor', label: 'Anchor diversity', test: /anchor|exact-match|diversif/i },
  { key: 'intent', label: 'Search intent', test: /intent/i },
  { key: 'accuracy', label: 'Accuracy / sources', test: /accuracy|source|fact|cite|stat/i },
];
export function categorizeRevision(note: string): { key: string; label: string } {
  const hit = REVISION_CATEGORIES.find((c) => c.test.test(note));
  return hit ? { key: hit.key, label: hit.label } : { key: 'other', label: 'Other' };
}

export interface RevisionReason { key: string; label: string; count: number; examples: { code: string; note: string }[]; }
export function revisionReasons(items: WorkItem[]): RevisionReason[] {
  const bucket = new Map<string, RevisionReason>();
  for (const i of items) {
    if (i.revisions === 0 || !i.reviewNote) continue;
    const cat = categorizeRevision(i.reviewNote);
    const cur = bucket.get(cat.key) ?? { key: cat.key, label: cat.label, count: 0, examples: [] };
    cur.count += 1;
    cur.examples.push({ code: i.code, note: i.reviewNote });
    bucket.set(cat.key, cur);
  }
  return [...bucket.values()].sort((a, b) => b.count - a.count);
}

// ---- Task timeline: reconstruct the key dates of a completed task ----
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`); // parse + format both in UTC → no timezone drift
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export interface TaskTimeline { started: string; deadline: string; completed: string; metDeadline: boolean; }
// `completedAt` + turnaround `days` give the start; the deadline sits a couple of days after
// completion when it landed on time, or before it when it slipped — consistent with `onTime`.
export function taskTimeline(item: { completedAt: string; days: number; onTime: boolean }): TaskTimeline {
  return {
    started: addDays(item.completedAt, -item.days),
    deadline: addDays(item.completedAt, item.onTime ? 2 : -2),
    completed: item.completedAt,
    metDeadline: item.onTime,
  };
}

// ---- Notification day bucket: Today / Yesterday / Earlier, from an ISO timestamp ----
export type DayBucket = 'Today' | 'Yesterday' | 'Earlier';
export function dayBucket(ts: string, today: string = TODAY): DayBucket {
  const day = ts.slice(0, 10);
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return 'Earlier';
}
