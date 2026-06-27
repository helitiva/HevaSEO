import { describe, it, expect } from 'vitest';
import {
  slaChip, nextStaffActions, bumpVersion, daysToDue, PRIORITY_RANK,
  throughputPct, modelComposite, scoreBreakdown, improvementLever,
  SCORE_MODEL, THROUGHPUT_TARGET, QUALITY_GOAL, ON_TIME_GOAL,
  workStats, summariseEarnings,
  ratingTrend, firstPassStreak, tasksByCustomer, revisionReasons, categorizeRevision,
  taskTimeline, commissionTierFor, dayBucket,
  type WorkItem, type MonthEarning,
} from './staff';
import { MY_TASKS, myWorkStats, earningsHistory, buildActivity, taskPenalty } from '@/data/staffMock';

describe('slaChip', () => {
  it('flags overdue with day count and bad tone', () => {
    expect(slaChip(-3)).toEqual({ label: 'Overdue 3d', tone: 'bad' });
  });
  it('flags due-today as warn', () => {
    expect(slaChip(0)).toEqual({ label: 'Due today', tone: 'warn' });
  });
  it('treats 1-2 days out as soft, beyond as neutral', () => {
    expect(slaChip(2)?.tone).toBe('soft');
    expect(slaChip(5)?.tone).toBe('neutral');
  });
  it('returns null when there is no deadline', () => {
    expect(slaChip(null)).toBeNull();
  });
});

describe('nextStaffActions (invariant: staff can never approve/deliver/cancel)', () => {
  it('assigned → Start only', () => {
    expect(nextStaffActions('assigned').map((a) => a.to)).toEqual(['in_progress']);
  });
  it('in_progress → Submit for review only', () => {
    expect(nextStaffActions('in_progress').map((a) => a.to)).toEqual(['internal_review']);
  });
  it('changes_requested → Resume only', () => {
    expect(nextStaffActions('changes_requested').map((a) => a.to)).toEqual(['in_progress']);
  });
  it('never offers approve/deliver/cancel for any status', () => {
    const all = (['new', 'confirmed', 'assigned', 'in_progress', 'internal_review', 'delivered', 'changes_requested', 'approved', 'completed', 'canceled'] as const)
      .flatMap((s) => nextStaffActions(s).map((a) => a.to));
    expect(all).not.toContain('approved');
    expect(all).not.toContain('delivered');
    expect(all).not.toContain('completed');
    expect(all).not.toContain('canceled');
  });
  it('offers nothing once delivered/approved/completed', () => {
    expect(nextStaffActions('delivered')).toEqual([]);
    expect(nextStaffActions('approved')).toEqual([]);
    expect(nextStaffActions('completed')).toEqual([]);
  });
});

describe('bumpVersion', () => {
  it('starts at v1 with no history', () => {
    expect(bumpVersion([])).toBe(1);
  });
  it('bumps past the highest existing version', () => {
    expect(bumpVersion([{ version: 1 }, { version: 2 }])).toBe(3);
  });
});

describe('daysToDue', () => {
  it('is 0 on the deadline day', () => {
    expect(daysToDue('2026-06-26', '2026-06-26')).toBe(0);
  });
  it('is negative when overdue', () => {
    expect(daysToDue('2026-06-24', '2026-06-26')).toBe(-2);
  });
  it('is null with no deadline', () => {
    expect(daysToDue(null)).toBeNull();
  });
});

describe('no-money invariant (StaffTask never carries price)', () => {
  it('no task in the staff mock exposes value or price', () => {
    for (const t of MY_TASKS) {
      expect(t).not.toHaveProperty('value');
      expect(t).not.toHaveProperty('price');
    }
  });
});

describe('PRIORITY_RANK', () => {
  it('orders high before med before low', () => {
    expect(PRIORITY_RANK.high).toBeLessThan(PRIORITY_RANK.med);
    expect(PRIORITY_RANK.med).toBeLessThan(PRIORITY_RANK.low);
  });
});

describe('score model invariants', () => {
  it('weights sum to 1', () => {
    const total = SCORE_MODEL.reduce((sum, t) => sum + t.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe('throughputPct', () => {
  it('maps the target volume to 100', () => {
    expect(throughputPct(THROUGHPUT_TARGET)).toBe(100);
  });
  it('caps above the target so raw speed cannot dominate', () => {
    expect(throughputPct(THROUGHPUT_TARGET * 2)).toBe(100);
  });
  it('scales linearly below the target and never goes negative', () => {
    expect(throughputPct(0)).toBe(0);
    expect(throughputPct(Math.round(THROUGHPUT_TARGET / 2))).toBeGreaterThan(40);
  });
});

describe('modelComposite', () => {
  it('is the weighted blend of the three normalised levers', () => {
    // quality 88, on-time 79, throughput 40 → tp% = round(40/45*100)=89
    // 0.45*88 + 0.35*79 + 0.20*89 = 39.6 + 27.65 + 17.8 = 85.05 → 85
    expect(modelComposite({ quality: 88, onTime: 79, throughput: 40 })).toBe(85);
  });
  it('is 100 when every lever is maxed', () => {
    expect(modelComposite({ quality: 100, onTime: 100, throughput: THROUGHPUT_TARGET })).toBe(100);
  });
});

describe('scoreBreakdown', () => {
  it('reconciles segments to sum exactly to the passed composite', () => {
    const b = scoreBreakdown({ quality: 88, onTime: 79, throughput: 40 }, 84);
    const sum = b.segments.reduce((s, seg) => s + seg.points, 0);
    expect(Math.round(sum)).toBe(84); // segments add up to the headline, not the model's 85
  });
  it('marks only quality and on-time as actionable; throughput has no goal', () => {
    const b = scoreBreakdown({ quality: 88, onTime: 79, throughput: 40 }, 84);
    const tp = b.segments.find((s) => s.key === 'throughput');
    expect(tp?.actionable).toBe(false);
    expect(tp?.goal).toBeNull();
    expect(tp?.headroom).toBe(0);
  });
  it('computes per-lever headroom as (goal − score) × weight', () => {
    const b = scoreBreakdown({ quality: 88, onTime: 79, throughput: 40 }, 84);
    const onTime = b.segments.find((s) => s.key === 'on-time');
    // (90 − 79) × 0.35 = 3.85, rounded to 1 dp for display → 3.9
    expect(onTime?.headroom).toBe(3.9);
  });
});

describe('improvementLever (weight-aware coaching)', () => {
  it('picks on-time over quality when its weighted headroom is larger', () => {
    // quality gap 7 × 0.45 = 3.15 ; on-time gap 11 × 0.35 = 3.85 → on-time wins
    const lever = improvementLever({ quality: 88, onTime: 79 });
    expect(lever?.key).toBe('on-time');
    expect(lever?.headroom).toBe(3.9); // 3.85 rounded to 1 dp for display
  });
  it('keeps quality and on-time headroom on the same rounding basis', () => {
    // quality gap 7 × 0.45 = 3.15 → 3.2 after 1 dp rounding
    expect(improvementLever({ quality: 88, onTime: 100 })?.headroom).toBe(3.2);
  });
  it('picks quality when it has the larger weighted headroom', () => {
    // quality 70 → gap 25 × 0.45 = 11.25 ; on-time 88 → gap 2 × 0.35 = 0.7
    expect(improvementLever({ quality: 70, onTime: 88 })?.key).toBe('quality');
  });
  it('never recommends throughput, even when a staffer is a high-volume low-quality outlier', () => {
    const lever = improvementLever({ quality: 60, onTime: 95 });
    expect(lever?.key).toBe('quality');
    expect(['on-time', 'quality']).toContain(lever?.key);
  });
  it('returns null when both levers are at or above goal', () => {
    expect(improvementLever({ quality: QUALITY_GOAL, onTime: ON_TIME_GOAL })).toBeNull();
    expect(improvementLever({ quality: 98, onTime: 95 })).toBeNull();
  });
});

const sampleWork: WorkItem[] = [
  { code: 'A', service: 'Content', pkg: '5', customer: 'Acme Co', completedAt: '2026-06-01', versions: 1, revisions: 0, onTime: true, rating: 5, days: 5, reviewNote: null, commission: 40 },
  { code: 'B', service: 'Content', pkg: '3', customer: 'Nova', completedAt: '2026-05-01', versions: 2, revisions: 1, onTime: false, rating: 3, days: 7, reviewNote: 'Tone read a bit generic.', commission: 30 },
  { code: 'C', service: 'Keyword', pkg: 'Pro', customer: 'Acme Co', completedAt: '2026-04-01', versions: 1, revisions: 0, onTime: true, rating: null, days: 3, reviewNote: null, commission: 50 },
];

describe('workStats', () => {
  const st = workStats(sampleWork);
  it('counts totals and groups by service (largest first)', () => {
    expect(st.total).toBe(3);
    expect(st.byService[0]).toMatchObject({ service: 'Content', count: 2 });
    expect(st.byService.find((s) => s.service === 'Keyword')?.count).toBe(1);
  });
  it('derives revision metrics', () => {
    expect(st.tasksWithRevision).toBe(1);
    expect(st.totalRevisionRounds).toBe(1);
    expect(st.revisionRate).toBe(33);   // 1 of 3
    expect(st.firstPassRate).toBe(67);  // 2 of 3
  });
  it('averages only rated tasks and builds the distribution', () => {
    expect(st.rated).toBe(2);           // C is unrated
    expect(st.avgRating).toBe(4);       // (5 + 3) / 2
    expect(st.ratingDist[5]).toBe(1);
    expect(st.ratingDist[3]).toBe(1);
    expect(st.bestRating).toBe(5);
    expect(st.worstRating).toBe(3);
  });
  it('computes on-time rate and average turnaround', () => {
    expect(st.onTimeCount).toBe(2);
    expect(st.onTimeRate).toBe(67);
    expect(st.avgTurnaround).toBe(5);   // (5 + 7 + 3) / 3
  });
  it('totals and averages per-task commission (own pay)', () => {
    expect(st.totalCommission).toBe(120); // 40 + 30 + 50
    expect(st.avgCommission).toBe(40);
  });
  it('handles an empty archive without dividing by zero', () => {
    const empty = workStats([]);
    expect(empty.total).toBe(0);
    expect(empty.avgRating).toBeNull();
    expect(empty.firstPassRate).toBe(0);
  });
});

describe('summariseEarnings', () => {
  const hist: MonthEarning[] = [
    { month: '2026-04', label: 'Apr', base: 1300, commission: 100, bonus: 0, takeHome: 1400, tasks: 2 },
    { month: '2026-05', label: 'May', base: 1300, commission: 150, bonus: 100, takeHome: 1550, tasks: 3 },
    { month: '2026-06', label: 'Jun', base: 1300, commission: 72, bonus: 0, takeHome: 1372, tasks: 4 },
  ];
  const sum = summariseEarnings(hist);
  it('totals YTD and averages per month', () => {
    expect(sum.ytd).toBe(4322);
    expect(sum.avg).toBe(1441);
  });
  it('computes month-over-month change against the prior month', () => {
    // (1372 − 1550) / 1550 = −11.5%
    expect(sum.momPct).toBe(-11.5);
  });
  it('finds the best month and totals commission/bonus', () => {
    expect(sum.best?.label).toBe('May');
    expect(sum.totalCommission).toBe(322);
    expect(sum.totalBonus).toBe(100);
  });
});

describe('ratingTrend', () => {
  it('averages ratings per month, oldest first, skipping unrated', () => {
    const t = ratingTrend(sampleWork);
    expect(t.map((p) => p.month)).toEqual(['2026-05', '2026-06']); // April task unrated → dropped
    expect(t[0]).toMatchObject({ label: 'May', avg: 3, count: 1 });
    expect(t[1]).toMatchObject({ label: 'Jun', avg: 5, count: 1 });
  });
});

describe('firstPassStreak', () => {
  it('counts the current run of zero-revision deliveries from newest', () => {
    // newest A(0 rev) → B(1 rev): current stops at 1
    expect(firstPassStreak(sampleWork)).toMatchObject({ current: 1 });
  });
  it('finds the best run anywhere in history', () => {
    const items: WorkItem[] = [
      { ...sampleWork[0], code: 'X1', completedAt: '2026-01-01', revisions: 0 },
      { ...sampleWork[0], code: 'X2', completedAt: '2026-02-01', revisions: 0 },
      { ...sampleWork[0], code: 'X3', completedAt: '2026-03-01', revisions: 1 },
      { ...sampleWork[0], code: 'X4', completedAt: '2026-04-01', revisions: 0 },
    ];
    expect(firstPassStreak(items)).toEqual({ current: 1, best: 2 });
  });
});

describe('tasksByCustomer', () => {
  it('counts tasks per customer (largest first) with avg rating', () => {
    const rows = tasksByCustomer(sampleWork);
    expect(rows[0]).toMatchObject({ customer: 'Acme Co', count: 2 }); // A + C
    expect(rows[0].avgRating).toBe(5); // only A is rated (C null)
    expect(rows.find((r) => r.customer === 'Nova')?.count).toBe(1);
  });
});

describe('revisionReasons', () => {
  it('categorises review notes by keyword', () => {
    expect(categorizeRevision('Add internal links and meta').key).toBe('meta');
    expect(categorizeRevision('Tone read generic').key).toBe('tone');
    expect(categorizeRevision('Anchors too exact-match').key).toBe('anchor');
    expect(categorizeRevision('Add a search-intent column').key).toBe('intent');
    expect(categorizeRevision('Something unusual').key).toBe('other');
  });
  it('aggregates only revised tasks with notes, with an example', () => {
    const reasons = revisionReasons(sampleWork);
    expect(reasons).toHaveLength(1); // only B has a revision + note
    expect(reasons[0]).toMatchObject({ key: 'tone', count: 1 });
    expect(reasons[0].examples[0].code).toBe('B');
  });
});

describe('commissionTierFor (performance → commission band)', () => {
  it('places a composite in the right tier', () => {
    expect(commissionTierFor(60).current.level).toBe('Starter');
    expect(commissionTierFor(80).current.level).toBe('Standard');
    expect(commissionTierFor(88).current.level).toBe('Senior');
    expect(commissionTierFor(95).current.level).toBe('Lead');
  });
  it('reports the distance to the next tier', () => {
    const at84 = commissionTierFor(84); // Standard, Senior starts at 85
    expect(at84.current.level).toBe('Standard');
    expect(at84.next?.level).toBe('Senior');
    expect(at84.toNext).toBe(1);
  });
  it('has no next tier at the top', () => {
    expect(commissionTierFor(99).next).toBeNull();
  });
});

describe('dayBucket (notification grouping)', () => {
  const today = '2026-06-26';
  it('buckets same-day timestamps as Today', () => {
    expect(dayBucket('2026-06-26T08:10', today)).toBe('Today');
  });
  it('buckets the prior day as Yesterday', () => {
    expect(dayBucket('2026-06-25T16:00', today)).toBe('Yesterday');
  });
  it('buckets anything older as Earlier', () => {
    expect(dayBucket('2026-06-24T10:00', today)).toBe('Earlier');
    expect(dayBucket('2026-05-01T10:00', today)).toBe('Earlier');
  });
});

describe('taskTimeline', () => {
  it('derives start from turnaround and sets deadline after completion when on time', () => {
    const tl = taskTimeline({ completedAt: '2026-06-22', days: 6, onTime: true });
    expect(tl.started).toBe('2026-06-16');     // 22 − 6
    expect(tl.deadline).toBe('2026-06-24');    // 22 + 2
    expect(tl.completed).toBe('2026-06-22');
    expect(tl.metDeadline).toBe(true);
  });
  it('puts the deadline before completion when the task ran late', () => {
    const tl = taskTimeline({ completedAt: '2026-05-20', days: 6, onTime: false });
    expect(tl.deadline).toBe('2026-05-18');    // 20 − 2 (missed)
    expect(tl.metDeadline).toBe(false);
  });
});

describe('taskPenalty (per-task fine roll-up)', () => {
  it('rolls an applied fine onto its task', () => {
    expect(taskPenalty('KW-0987')).toMatchObject({ applied: 25, pending: 0, net: 25 });
  });
  it('rolls a pending fine separately from applied', () => {
    expect(taskPenalty('CNT-1004')).toMatchObject({ applied: 0, pending: 12, net: 12 });
  });
  it('sums applied + keeps waived out of the net', () => {
    const p = taskPenalty('CNT-0925');
    expect(p).toMatchObject({ applied: 18, waived: 15, net: 18 });
    expect(p?.items).toHaveLength(2);
  });
  it('returns null for a clean task', () => {
    expect(taskPenalty('CNT-1038')).toBeNull();
  });
});

describe('staff mock track record (Huy / s3)', () => {
  it('archive aggregates are internally consistent with his ~79% on-time profile', () => {
    const st = myWorkStats();
    expect(st.total).toBe(16);
    expect(st.onTimeRate).toBeGreaterThanOrEqual(75); // 13 of 16 on time
    expect(st.onTimeRate).toBeLessThanOrEqual(85);
    expect(st.avgRating).toBeGreaterThan(3.5);
    expect(st.byService[0].service).toBe('Content'); // content lead
  });
  it('earnings history current month matches the live payout and runs 6 months', () => {
    const h = earningsHistory();
    expect(h).toHaveLength(6);
    expect(h[h.length - 1].label).toBe('Jun');
    expect(h[h.length - 1].takeHome).toBe(h[h.length - 1].base + h[h.length - 1].commission + h[h.length - 1].bonus);
  });
});

describe('buildActivity (Day/Week/Month/Year, stacked by type)', () => {
  const a = buildActivity();
  it('produces the expected bucket counts per granularity', () => {
    expect(a.day).toHaveLength(14);
    expect(a.week).toHaveLength(12);
    expect(a.month).toHaveLength(12);
    expect(a.year.map((b) => b.label)).toEqual(['2023', '2024', '2025', '2026']);
  });
  it('each bucket total equals the sum of its type slices (tasks and pay)', () => {
    for (const g of ['day', 'week', 'month', 'year'] as const) {
      for (const b of a[g]) {
        expect(b.tasks).toBe(b.slices.reduce((s, x) => s + x.tasks, 0));
        expect(b.pay).toBe(b.slices.reduce((s, x) => s + x.pay, 0));
      }
    }
  });
  it('is deterministic across calls', () => {
    expect(buildActivity().month.map((b) => b.tasks)).toEqual(a.month.map((b) => b.tasks));
  });
  it('months and years carry real volume (not all-empty buckets)', () => {
    expect(a.month.reduce((s, b) => s + b.tasks, 0)).toBeGreaterThan(40);
    expect(a.year[0].tasks).toBeGreaterThan(20);
  });
});
