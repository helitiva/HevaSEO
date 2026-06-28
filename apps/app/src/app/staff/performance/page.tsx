import { PageHeader } from '@/components/shared/PageHeader';
import { KpiTile } from '@/components/shared/KpiTile';
import { EmptyState } from '@/components/staff/EmptyState';
import { STAFF, money } from '@/data/adminMock';
import {
  myCustomers, latestReview, myManager, deliverableStats,
  myWorkStats, workHistory, activeWorkload, serviceMeta, liveTaskIdForCode,
  buildActivity, ACTIVITY_TYPE_META, taskPenalty, myPenalties, myRewards,
} from '@/data/staffMock';
import { appliedPenaltyTotal, summarisePenalties, PENALTY_TYPE_META, PENALTY_STATUS_META, type StaffPenalty } from '@/lib/staffFinance';
import { rewardsEarned, rewardsOnOffer, REWARD_KIND_META, type Reward } from '@/lib/staffRewards';
import { WorkActivityChart } from '@/components/staff/WorkActivityChart';
import {
  rankByComposite, improvementLever, scoreBreakdown, commissionTierFor,
  ratingTrend, firstPassStreak, tasksByCustomer, revisionReasons,
  type ScoreKey, type ScoreSegment, type ServiceStat, type WorkItem,
  type RatingPoint, type CustomerWork, type RevisionReason,
} from '@/lib/staff';
import { currentStaffId } from '@/lib/currentStaff';
import { mockTodayDate } from '@/lib/today';

// The staffer's own standing: scorecard, earnings (their OWN pay — customer prices stay hidden),
// team ranking by performance, and the customers they're caring for.
export default async function PerformancePage() {
  const sid = await currentStaffId();
  const s = STAFF.find((x) => x.id === sid);

  if (!s) {
    return (
      <section>
        <PageHeader title="My standing" subtitle="Your scorecard, earnings & ranking" />
        <EmptyState kind="new-hire" />
      </section>
    );
  }

  const trend = s.trend;
  const thisWeek = trend[trend.length - 1];
  const prevWeek = trend[trend.length - 2] ?? thisWeek;
  const weeklyAvg = Math.round(trend.reduce((a, b) => a + b, 0) / trend.length);
  const peak = Math.max(...trend);
  const delta = thisWeek - prevWeek;

  const rank = rankByComposite(STAFF, s.id);
  const board = [...STAFF].sort((a, b) => b.composite - a.composite || a.id.localeCompare(b.id));
  const customers = myCustomers(sid);

  // Coaching inputs — the "what to do next" half of the page.
  const lever = improvementLever({ quality: s.quality, onTime: s.onTime });
  const review = latestReview(sid);
  const manager = myManager(sid);
  const dstats = deliverableStats(sid);
  const leverCopy = leverGuidance(lever, s, dstats);

  // Score breakdown — segments reconcile to the headline composite (see scoreBreakdown).
  const breakdown = scoreBreakdown({ quality: s.quality, onTime: s.onTime, throughput: s.throughput }, s.composite);

  // Track record + earnings history — the data-dense "everything about my work" half.
  const work = myWorkStats(sid);
  const history = workHistory(sid);
  const activeNow = activeWorkload(sid);
  const activity = buildActivity(sid);

  // Extra track-record cuts.
  const ratings = ratingTrend(history);
  const streak = firstPassStreak(history);
  const byCustomer = tasksByCustomer(history);
  const reasons = revisionReasons(history);
  const monthsActive = ratings.length || 1;
  const tasksPerMonth = Math.round((work.total / monthsActive) * 10) / 10;
  const tenure = tenureSince(s.since);

  // Commission tier — performance-based; managers bump it up as the composite climbs.
  const tier = commissionTierFor(s.composite);
  const penalties = myPenalties(sid);
  const finesTotal = appliedPenaltyTotal(penalties);
  const penSummary = summarisePenalties(penalties, '2026-06');

  // Bonus rewards — progress toward performance milestones that pay a one-off bonus.
  const rewards = myRewards(sid);
  const bonusEarned = rewardsEarned(rewards);
  const bonusOnOffer = rewardsOnOffer(rewards);

  // You vs team — compare the scored metrics against the team mean.
  const teamMean = (pick: (m: typeof STAFF[number]) => number) => Math.round(STAFF.reduce((a, m) => a + pick(m), 0) / STAFF.length);
  const vsTeam = [
    { label: 'Composite', mine: s.composite, team: teamMean((m) => m.composite), suffix: '' },
    { label: 'Quality', mine: s.quality, team: teamMean((m) => m.quality), suffix: '%' },
    { label: 'On-time', mine: s.onTime, team: teamMean((m) => m.onTime), suffix: '%' },
    { label: 'Throughput', mine: s.throughput, team: teamMean((m) => m.throughput), suffix: '' },
  ];

  const headline =
    s.composite >= 90 ? 'You’re delivering at the top of the team — keep it steady.'
      : s.composite >= 80 ? 'Solid, dependable work. A little more on-time consistency lifts you further.'
        : 'You’re building momentum. Quality is your strength — protect your deadlines next.';

  return (
    <section>
      <PageHeader title="My standing" subtitle="How your delivery is scoring, what you’re earning, and where you rank" />

      <div className="kcard mb-3 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <i className="ph-bold ph-trophy text-xl" aria-hidden />
        </span>
        <div>
          <p className="display text-lg font-bold">Composite {s.composite}{rank && <span className="ml-2 align-middle text-sm font-semibold text-muted-foreground">#{rank.rank} of {rank.total} on the team</span>}</p>
          <p className="text-sm text-muted-foreground">{headline}</p>
        </div>
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon="ph-medal" label="Composite" value={String(s.composite)} hint="quality · on-time · throughput" tone="good" />
        <KpiTile icon="ph-seal-check" label="Quality" value={`${s.quality}%`} hint="review pass rate" tone="good" />
        <KpiTile icon="ph-clock" label="On-time" value={`${s.onTime}%`} hint="delivered by deadline" tone={s.onTime < 85 ? 'warn' : 'good'} />
        <KpiTile icon="ph-lightning" label="Throughput" value={String(s.throughput)} hint="tasks · last 30 days" />
      </div>

      {/* Where to focus — the actionable half: your lever + latest QA + manager guidance */}
      <div className="mb-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <i className="ph-bold ph-target text-primary" aria-hidden /> Where to focus
        </p>
        <div className="grid gap-3 lg:grid-cols-3">
          {/* 1. Your lever — the coachable metric with the most composite headroom */}
          <div className="kcard border-primary/30 bg-primary/[0.04]">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <i className={`ph-fill ${leverCopy.icon} text-primary`} aria-hidden /> {leverCopy.title}
              </p>
              {lever && lever.headroom > 0 && (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary" title="Composite points you could gain by hitting the goal on this lever">
                  +{lever.headroom} pts
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{leverCopy.body}</p>
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-card px-2.5 py-2 text-xs">
              <i className="ph-bold ph-arrow-bend-down-right mt-0.5 text-primary" aria-hidden />
              <span><span className="font-semibold text-foreground">Do next:</span> {leverCopy.action}</span>
            </p>
          </div>

          {/* 2. Latest review — the reviewer literally told you what to fix */}
          <div className="kcard">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <i className="ph-bold ph-chat-circle-text text-primary" aria-hidden /> Latest review
            </p>
            {review ? (
              <>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{review.taskCode}</span>
                  <span className={`pill ${review.changesRequested ? 'pill-warn' : 'pill-good'}`}>
                    {review.changesRequested ? 'Changes requested' : 'Approved'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">“{review.note}”</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Reviewed {review.at}</p>
              </>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">No review feedback yet — your last submissions are still in QA.</p>
            )}
          </div>

          {/* 3. From your manager — standing guidance from whoever reviews your work */}
          <div className="kcard">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <i className="ph-bold ph-user-circle-gear text-primary" aria-hidden /> From your manager
            </p>
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                {manager.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{manager.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{manager.title}</p>
              </div>
            </div>
            {manager.note ? (
              <p className="text-sm text-muted-foreground">{manager.note}</p>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">No standing notes right now.</p>
            )}
          </div>
        </div>
      </div>

      {/* Earnings moved to the dedicated Finance page — keep a pointer here. */}
      <a href="/staff/finance" className="mb-3 flex items-center gap-3 kcard transition hover:border-primary/40">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><i className="ph-bold ph-wallet text-xl" aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Pay, wallet &amp; penalties</p>
          <p className="text-xs text-muted-foreground">Your commission wallet, payouts and fines now live on the Finance page.</p>
        </div>
        <i className="ph-bold ph-arrow-right ml-auto shrink-0 text-muted-foreground" aria-hidden />
      </a>

      {/* Work activity — interactive: Day/Week/Month/Year, each bar stacked by task type */}
      <div className="mb-3 kcard">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-bar text-primary" aria-hidden /> Work activity</p>
          <span className="hidden text-xs text-muted-foreground sm:inline">tasks by type over time · switch the range</span>
        </div>
        <WorkActivityChart data={activity} types={ACTIVITY_TYPE_META} />
      </div>

      {/* Track record — every task completed, by service, with revisions + ratings */}
      <div className="mb-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <i className="ph-bold ph-medal-military text-primary" aria-hidden /> Track record
            <span className="font-normal normal-case text-muted-foreground">· lifetime delivery quality</span>
          </p>
          <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><i className="ph-bold ph-hourglass-medium" aria-hidden /> {tenure} on the team</span>
            <span className="flex items-center gap-1"><i className="ph-bold ph-gauge" aria-hidden /> {tasksPerMonth} tasks/mo avg</span>
            <span className="flex items-center gap-1" title="consecutive first-pass deliveries">
              <i className="ph-fill ph-fire text-amber-500" aria-hidden /> {streak.current} first-pass streak
              {streak.best > streak.current && <span className="text-muted-foreground/70">(best {streak.best})</span>}
            </span>
          </span>
        </div>

        {/* stat tiles */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile icon="ph-checks" label="Tasks done" value={String(work.total)} sub={`${activeNow} in flight now`} />
          <StatTile icon="ph-seal-check" label="First-pass" value={`${work.firstPassRate}%`} sub="no revisions" tone={work.firstPassRate >= 70 ? 'good' : 'warn'} />
          <StatTile icon="ph-arrows-counter-clockwise" label="Revision rate" value={`${work.revisionRate}%`} sub={`${work.avgRevisions} rounds/task`} tone={work.revisionRate <= 30 ? 'good' : 'warn'} />
          <StatTile icon="ph-star" label="Avg rating" value={work.avgRating !== null ? work.avgRating.toFixed(1) : '—'} sub={`${work.rated} rated`} tone="good" />
          <StatTile icon="ph-clock" label="On-time" value={`${work.onTimeRate}%`} sub={`${work.onTimeCount}/${work.total} tasks`} tone={work.onTimeRate >= 85 ? 'good' : 'warn'} />
          <StatTile icon="ph-timer" label="Avg turnaround" value={work.avgTurnaround !== null ? `${work.avgTurnaround}d` : '—'} sub="start → delivery" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* by service */}
          <div className="kcard">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-squares-four text-primary" aria-hidden /> By service
              {work.topService && <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Strongest: {work.topService}</span>}
            </p>
            <ul className="space-y-2.5">
              {work.byService.map((sv) => <ServiceRow key={sv.service} sv={sv} max={work.byService[0]?.count ?? 1} />)}
            </ul>
          </div>

          {/* rating distribution */}
          <div className="kcard">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-star-half text-amber-500" aria-hidden /> Rating distribution</p>
              <span className="text-xs text-muted-foreground">avg <span className="font-bold text-foreground">{work.avgRating?.toFixed(1) ?? '—'}</span>/5 · {work.rated} rated</span>
            </div>
            <ul className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => (
                <RatingBar key={star} star={star} count={work.ratingDist[star] ?? 0} total={work.rated} />
              ))}
            </ul>
            {ratings.length > 1 && (
              <div className="mt-3 border-t border-border pt-2">
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Avg rating by month</p>
                <RatingTrend points={ratings} />
              </div>
            )}
          </div>
        </div>

        {/* revision reasons + tasks per customer */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="kcard">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-arrows-counter-clockwise text-amber-500" aria-hidden /> Why work came back</p>
              <span className="text-xs text-muted-foreground">{work.tasksWithRevision} of {work.total} tasks</span>
            </div>
            {reasons.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">No rework on record — clean first passes. 🎯</p>
            ) : (
              <ul className="space-y-2.5">
                {reasons.map((r) => <ReasonRow key={r.key} r={r} max={reasons[0].count} />)}
              </ul>
            )}
          </div>

          <div className="kcard">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-buildings text-primary" aria-hidden /> Tasks by customer</p>
              <span className="text-xs text-muted-foreground">{byCustomer.length} clients</span>
            </div>
            <ul className="space-y-2">
              {byCustomer.map((c) => <CustomerRow key={c.customer} c={c} max={byCustomer[0]?.count ?? 1} />)}
            </ul>
          </div>
        </div>
      </div>

      {/* Task history — per-task detail + commission earned */}
      <div className="mb-3 kcard">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-list-bullets text-primary" aria-hidden /> Task history
            <span className="hidden font-normal text-muted-foreground sm:inline">· click a code to open the full task <i className="ph-bold ph-arrow-square-out" aria-hidden /></span>
          </p>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {history.length} tasks · <span className="text-emerald-600">{money(work.totalCommission)}</span> commission{finesTotal > 0 && <> · <span className="text-red-500">−{money(finesTotal)}</span> fines</>}
          </span>
        </div>

        {/* Commission tier — performance-based; admin raises it as you climb */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-xs">
          <i className="ph-fill ph-medal text-emerald-500" aria-hidden />
          <span>Commission tier: <span className="font-semibold text-foreground">{tier.current.level}</span> <span className="text-muted-foreground">({tier.current.mult}× base · avg {money(work.avgCommission ?? 0)}/task)</span></span>
          {tier.next ? (
            <span className="text-muted-foreground">— {tier.toNext} composite pt{tier.toNext === 1 ? '' : 's'} to <span className="font-semibold text-emerald-600">{tier.next.level}</span> ({tier.next.mult}×)</span>
          ) : (
            <span className="font-semibold text-emerald-600">— top tier 🎉</span>
          )}
          <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">Set by performance · your manager bumps it as your composite rises</span>
        </div>

        <div className="max-h-[22rem] overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="p-2">Code &amp; date</th>
                <th className="p-2">Service</th>
                <th className="hidden p-2 lg:table-cell">Customer</th>
                <th className="hidden p-2 sm:table-cell">Package</th>
                <th className="p-2 text-center">Revisions</th>
                <th className="hidden p-2 text-center sm:table-cell">On-time</th>
                <th className="p-2 text-right">Rating</th>
                <th className="p-2 text-right">Commission</th>
                <th className="p-2 text-right">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {history.map((t) => <TaskRow key={t.code} t={t} staffId={sid} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bonus rewards — progress bars toward milestone bonuses */}
      <div className="mb-3 kcard">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-fill ph-gift text-emerald-500" aria-hidden /> Bonus rewards</p>
          <span className="hidden text-xs text-muted-foreground sm:inline">hit a milestone → bonus into your wallet</span>
          <span className="ml-auto flex items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">{money(bonusEarned)} earned</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">{money(bonusOnOffer)} on offer</span>
          </span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => <RewardTile key={r.id} r={r} />)}
        </div>
      </div>

      {/* Penalties & reasons — the "what & why" of every fine */}
      <div className="mb-3 kcard">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-warning-octagon text-red-500" aria-hidden /> Penalties &amp; reasons</p>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{penSummary.total} on record</span>
        </div>

        {penSummary.total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No penalties on record — spotless. 🎉</p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <PenStat label="Applied" value={`−${money(penSummary.appliedTotal)}`} sub={`${penSummary.applied} fine${penSummary.applied === 1 ? '' : 's'} · debited`} tone="bad" />
              <PenStat label="Pending review" value={`−${money(penSummary.pendingTotal)}`} sub={`${penSummary.pending} flagged`} tone="warn" />
              <PenStat label="Waived" value={String(penSummary.waived)} sub="forgiven · $0" tone="muted" />
            </div>

            {penSummary.byType.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {penSummary.byType.map((t) => (
                  <span key={t.type} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
                    <i className={`ph-bold ${PENALTY_TYPE_META[t.type].icon} text-muted-foreground`} aria-hidden />
                    <span className="font-medium">{PENALTY_TYPE_META[t.type].label}</span>
                    <span className="text-muted-foreground">×{t.count}{t.amount > 0 ? ` · ${money(t.amount)}` : ''}</span>
                  </span>
                ))}
              </div>
            )}

            <ul className="divide-y divide-border/60 rounded-lg border border-border">
              {[...penalties].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => <PenaltyItem key={p.id} p={p} />)}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />Fines auto-flag from the rules; a manager can waive or you can dispute one.</p>
          </>
        )}
      </div>

      {/* Team context: You vs team + ranking */}
      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <div className="kcard">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-scales text-primary" aria-hidden /> You vs team average</p>
          <ul className="space-y-2.5">
            {vsTeam.map((r) => <VsTeamRow key={r.label} row={r} />)}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />Team average across all {STAFF.length} delivery staff.</p>
        </div>

        {rank && (
          <div className="kcard">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-ranking text-primary" aria-hidden /> Team ranking</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">by composite</span>
            </div>
            <p className="display text-3xl font-bold">#{rank.rank} <span className="text-base font-semibold text-muted-foreground">of {rank.total}</span></p>
            <p className="mb-3 text-xs text-muted-foreground">Top {rank.topPercent}% · ahead of {rank.aheadOf} teammate{rank.aheadOf === 1 ? '' : 's'}</p>
            <ul className="space-y-1">
              {board.map((m, i) => {
                const me = m.id === s.id;
                return (
                  <li key={m.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${me ? 'bg-primary/10 font-semibold' : ''}`}>
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 truncate">{me ? 'You' : m.name}</span>
                    <span className="display font-bold text-primary">{m.composite}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Customers being cared for */}
      <div className="mb-3 kcard">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-users-three text-primary" aria-hidden /> Customers you’re caring for</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{customers.length} active</span>
        </div>
        {customers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No active customers right now.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {customers.map((c) => (
              <div key={c.name} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.services.join(' · ')}</p>
                </div>
                <span className="pill pill-good shrink-0">{c.active} task{c.active === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scorecard detail */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="kcard lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-line-up text-primary" aria-hidden /> Throughput trend</p>
            <span className={`text-xs font-semibold ${delta >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
              <i className={`ph-bold ${delta >= 0 ? 'ph-trend-up' : 'ph-trend-down'}`} aria-hidden /> {delta >= 0 ? `+${delta}` : delta} vs last week
            </span>
          </div>
          <ThroughputChart data={trend} avg={weeklyAvg} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Mini label="This week" value={String(thisWeek)} />
            <Mini label="Weekly avg" value={String(weeklyAvg)} />
            <Mini label="Peak" value={String(peak)} />
          </div>
        </div>

        <div className="kcard">
          <div className="mb-1 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-pie-slice text-primary" aria-hidden /> How your score is built</p>
            <span className="display text-sm font-bold">{breakdown.composite}<span className="text-[11px] font-semibold text-muted-foreground">/100</span></span>
          </div>
          <p className="mb-2.5 text-[11px] text-muted-foreground">Weighted blend of the three things you control. Highlighted = your biggest lever.</p>

          {/* Stacked contribution bar — coloured chunks sum to your composite, grey = headroom to 100 */}
          <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Composite ${breakdown.composite} of 100`}>
            {breakdown.segments.map((seg) => (
              <span key={seg.key} className={SEG_COLOR[seg.key]} style={{ width: `${seg.points}%` }} title={`${seg.label}: ${seg.points} of ${breakdown.composite} pts`} />
            ))}
          </div>

          <ul className="space-y-2">
            {breakdown.segments.map((seg) => (
              <ScoreRow key={seg.key} seg={seg} isLever={!!lever && (lever.key === seg.key)} />
            ))}
          </ul>

          <p className="mt-3 rounded-lg bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <i className="ph-bold ph-info mr-1" aria-hidden />Throughput is volume context, not a target to push — and customer ratings aren’t live yet, so your score reflects delivery only.
          </p>
        </div>
      </div>
    </section>
  );
}

// Lever colours — shared by the stacked bar and the per-lever rows so they read as one chart.
const SEG_COLOR: Record<ScoreKey, string> = {
  quality: 'bg-emerald-500',
  'on-time': 'bg-primary',
  throughput: 'bg-violet-500',
};
const SEG_TEXT: Record<ScoreKey, string> = {
  quality: 'text-emerald-500',
  'on-time': 'text-primary',
  throughput: 'text-violet-500',
};

function ScoreRow({ seg, isLever }: { seg: ScoreSegment; isLever: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEG_COLOR[seg.key]}`} aria-hidden />
      <span className="flex-1 truncate">
        <span className="font-medium">{seg.label}</span>
        <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">{Math.round(seg.weight * 100)}%</span>
        {isLever && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">Your lever</span>}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{seg.score}{seg.goal !== null ? '%' : ''}</span>
      <span className={`w-14 shrink-0 text-right font-semibold ${SEG_TEXT[seg.key]}`}>{seg.points} pts</span>
      <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground" title="Composite points still gainable on this lever">
        {seg.actionable ? (seg.headroom > 0 ? `+${seg.headroom} left` : 'maxed') : '—'}
      </span>
    </li>
  );
}

// Turns the computed lever into staffer-facing coaching copy. Single-use presentational
// helper — the scoring decision lives in `improvementLever`; this only phrases it.
interface LeverCopy { icon: string; title: string; body: string; action: string; }
function leverGuidance(
  lever: ReturnType<typeof improvementLever>,
  s: { quality: number; onTime: number },
  d: { reworking: number; firstPassRate: number | null },
): LeverCopy {
  if (!lever) {
    return {
      icon: 'ph-trophy',
      title: 'You’re firing on both cylinders',
      body: `Quality ${s.quality}% and on-time ${s.onTime}% are both strong. Hold the standard — consistency is what keeps your composite high.`,
      action: 'Keep submitting before the SLA chip turns amber and your score holds.',
    };
  }
  if (lever.key === 'on-time') {
    return {
      icon: 'ph-clock',
      title: 'On-time is your biggest lever',
      body: `You’re at ${lever.score}% on-time while quality (${s.quality}%) is already strong — so the fastest way to lift your composite is protecting deadlines, not polishing more. Hitting the on-time goal is worth +${lever.headroom} composite points.`,
      action: 'Start tasks earlier and submit before the SLA chip turns amber; flag at-risk briefs to your manager today.',
    };
  }
  const fp = d.firstPassRate;
  return {
    icon: 'ph-seal-check',
    title: 'Quality is your biggest lever',
    body: `You’re at ${s.quality}% quality${fp !== null ? ` with a ${fp}% first-pass rate` : ''}${d.reworking > 0 ? ` — ${d.reworking} task${d.reworking === 1 ? '' : 's'} are in rework` : ''}. Tightening the first draft cuts rework rounds — closing the gap is worth +${lever.headroom} composite points.`,
    action: 'Run the QA checklist before submitting so fewer tasks bounce back for changes.',
  };
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-2 text-center"><p className="display text-sm font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}

// ---- Track-record helpers ----
function StatTile({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const ring = tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><i className={`ph-bold ${icon} ${ring}`} aria-hidden /> {label}</p>
      <p className="display mt-0.5 text-lg font-bold">{value}</p>
      {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ServiceRow({ sv, max }: { sv: ServiceStat; max: number }) {
  const meta = serviceMeta(sv.service);
  return (
    <li className="text-sm">
      <div className="mb-1 flex items-center gap-2">
        <i className={`ph-fill ${meta.icon}`} style={{ color: meta.color }} aria-hidden />
        <span className="font-medium">{meta.label}</span>
        <span className="text-xs text-muted-foreground">{sv.count} task{sv.count === 1 ? '' : 's'} · {sv.pct}%</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {sv.avgRating !== null && <span className="flex items-center gap-0.5"><i className="ph-fill ph-star text-amber-500" aria-hidden />{sv.avgRating.toFixed(1)}</span>}
          <span title="revision rate">↺ {sv.revisionRate}%</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${(sv.count / max) * 100}%`, backgroundColor: meta.color }} />
      </div>
    </li>
  );
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="flex w-9 shrink-0 items-center gap-0.5 text-xs font-semibold">{star}<i className="ph-fill ph-star text-amber-500" aria-hidden /></span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{count}</span>
    </li>
  );
}

function Stars({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${score}/5`} aria-label={`${score} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`ph-fill ph-star text-[11px] ${n <= score ? 'text-amber-500' : 'text-muted-foreground/30'}`} aria-hidden />
      ))}
    </span>
  );
}

function fmtShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function TaskRow({ t, staffId }: { t: WorkItem; staffId: string }) {
  const meta = serviceMeta(t.service);
  // Live board task → open the full task page; otherwise the read-only archived detail. Both new-tab.
  const liveId = liveTaskIdForCode(t.code);
  const href = liveId ? `/staff/tasks/${liveId}` : `/staff/history/${t.code}`;
  const pen = taskPenalty(t.code, staffId);
  return (
    <tr className="group border-b border-border/50 last:border-0 hover:bg-muted/40">
      <td className="p-2">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary hover:underline"
          title={liveId ? `Open the full task ${t.code} in a new tab` : `Open ${t.code} in a new tab`}
        >
          {t.code}
          <i className="ph-bold ph-arrow-square-out text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        </a>
        <span className="block text-[11px] text-muted-foreground">{fmtShortDate(t.completedAt)}</span>
      </td>
      <td className="p-2">
        <span className="inline-flex items-center gap-1.5"><i className={`ph-fill ${meta.icon}`} style={{ color: meta.color }} aria-hidden /> <span className="hidden md:inline">{meta.label}</span></span>
      </td>
      <td className="hidden p-2 text-muted-foreground lg:table-cell">{t.customer}</td>
      <td className="hidden p-2 text-muted-foreground sm:table-cell">{t.pkg}</td>
      <td className="p-2 text-center">
        {t.revisions === 0
          ? <span className="text-emerald-500" title="first pass"><i className="ph-bold ph-check" aria-hidden /></span>
          : <span className="rounded-full bg-amber-500/15 px-1.5 text-[11px] font-semibold text-amber-600">{t.revisions}</span>}
      </td>
      <td className="hidden p-2 text-center sm:table-cell">
        {t.onTime
          ? <i className="ph-bold ph-check-circle text-emerald-500" title="on time" aria-hidden />
          : <i className="ph-bold ph-x-circle text-amber-500" title="late" aria-hidden />}
      </td>
      <td className="p-2 text-right"><Stars score={t.rating} /></td>
      <td className="p-2 text-right font-semibold text-emerald-600">{money(t.commission)}</td>
      <td className="p-2 text-right"><PenaltyCell pen={pen} /></td>
    </tr>
  );
}

function RewardTile({ r }: { r: Reward }) {
  const kindTone = REWARD_KIND_META[r.kind].tone;
  // Rating shows a decimal; everything else is a whole number.
  const cur = r.id === 'rating' ? r.current.toFixed(1) : Math.round(r.current);
  return (
    <div className={`rounded-xl border p-3 ${r.unlocked ? 'border-emerald-500/40 bg-emerald-500/[0.05]' : 'border-border'}`}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <i className={`ph-fill ${r.icon} ${r.unlocked ? 'text-emerald-500' : kindTone}`} aria-hidden /> {r.title}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${r.unlocked ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>+{money(r.amount)}</span>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">{r.blurb}</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={r.progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all ${r.unlocked ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${r.progressPct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{cur} {r.unit}</span>
        <span className={`font-semibold ${r.unlocked ? 'text-emerald-600' : 'text-foreground'}`}>
          {r.unlocked && <i className="ph-bold ph-check-circle mr-0.5" aria-hidden />}{r.hint}
        </span>
      </div>
    </div>
  );
}

function PenStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'bad' | 'warn' | 'muted' }) {
  const color = tone === 'bad' ? 'text-red-500' : tone === 'warn' ? 'text-amber-500' : 'text-muted-foreground';
  return (
    <div className="rounded-xl border border-border p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`display text-lg font-bold ${color}`}>{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function PenaltyItem({ p }: { p: StaffPenalty }) {
  const meta = PENALTY_TYPE_META[p.type];
  const st = PENALTY_STATUS_META[p.status];
  const amtClass = p.status === 'applied' ? 'text-red-500' : p.status === 'pending' ? 'text-amber-500' : 'text-muted-foreground line-through';
  return (
    <li className="flex items-start gap-2.5 p-2.5 text-sm">
      <i className={`ph-bold ${meta.icon} mt-0.5 text-muted-foreground`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium">{meta.label}</span>
          {p.taskCode && (
            <a href={`/staff/history/${p.taskCode}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline">{p.taskCode}</a>
          )}
          <span className={`pill ${st.pill}`}>{st.label}</span>
        </div>
        <p className="text-[12px] text-muted-foreground">{p.reason}</p>
        <p className="text-[10px] text-muted-foreground">{p.detail} · {p.createdAt} · {p.by}</p>
      </div>
      <span className={`shrink-0 font-semibold ${amtClass}`}>−{money(p.amount)}</span>
    </li>
  );
}

function PenaltyCell({ pen }: { pen: ReturnType<typeof taskPenalty> }) {
  if (!pen) return <span className="text-muted-foreground">—</span>;
  const tip = pen.items.map((p) => `${p.detail} — ${p.reason} (${p.status})`).join(' · ');
  if (pen.applied > 0) {
    return (
      <span className="font-semibold text-red-500" title={tip}>
        −{money(pen.applied)}{pen.pending > 0 && <span className="font-normal text-amber-500"> +{money(pen.pending)}?</span>}
      </span>
    );
  }
  if (pen.pending > 0) {
    return <span className="font-semibold text-amber-500" title={tip}>−{money(pen.pending)} <span className="text-[10px] font-normal">pending</span></span>;
  }
  return <span className="text-muted-foreground" title={tip}>waived</span>;
}

// Tenure label from a join date → "3y 7mo".
function tenureSince(since: string): string {
  const start = new Date(`${since}T00:00:00`);
  const now = mockTodayDate();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y > 0 ? `${y}y ` : ''}${m}mo`;
}

function VsTeamRow({ row }: { row: { label: string; mine: number; team: number; suffix: string } }) {
  const delta = row.mine - row.team;
  const ahead = delta >= 0;
  const max = Math.max(row.mine, row.team, 1);
  return (
    <li>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{row.label}</span>
        <span className="flex items-center gap-2">
          <span className="font-semibold">{row.mine}{row.suffix}</span>
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${ahead ? 'text-emerald-500' : 'text-amber-500'}`}>
            <i className={`ph-bold ${ahead ? 'ph-arrow-up' : 'ph-arrow-down'}`} aria-hidden />
            {ahead ? '+' : ''}{delta}{row.suffix} vs team
          </span>
        </span>
      </div>
      {/* dual bar: muted = team avg, primary = you */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/30" style={{ width: `${(row.team / max) * 100}%` }} />
        <div className={`absolute inset-y-0 left-0 rounded-full ${ahead ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${(row.mine / max) * 100}%`, opacity: 0.55 }} />
      </div>
    </li>
  );
}

// SVG line chart on a fixed 1–5 scale (honest domain) with a dashed "4 = good" reference line.
function RatingTrend({ points }: { points: RatingPoint[] }) {
  const W = 560, H = 132, padL = 20, padR = 12, padT = 18, padB = 20;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = points.length;
  const xOf = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (v: number) => padT + plotH - ((v - 1) / 4) * plotH; // domain 1..5
  const linePts = points.map((p, i) => `${xOf(i)},${yOf(p.avg ?? 1)}`).join(' ');
  const areaPts = `${xOf(0)},${yOf(1)} ${linePts} ${xOf(n - 1)},${yOf(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label="Average rating by month">
      {[1, 2, 3, 4, 5].map((r) => (
        <g key={r}>
          <line x1={padL} y1={yOf(r)} x2={W - padR} y2={yOf(r)} stroke={r === 4 ? '#f59e0b' : 'currentColor'} className={r === 4 ? '' : 'text-border'} strokeWidth={1} strokeOpacity={r === 4 ? 0.5 : 0.4} strokeDasharray={r === 4 ? '4 3' : undefined} />
          <text x={padL - 4} y={yOf(r) + 3} textAnchor="end" fill="currentColor" className="text-muted-foreground" style={{ fontSize: 8 }}>{r}</text>
        </g>
      ))}
      <polygon points={areaPts} fill="#f59e0b" fillOpacity={0.12} />
      <polyline points={linePts} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.month}>
          <circle cx={xOf(i)} cy={yOf(p.avg ?? 1)} r={3} fill="#f59e0b">
            <title>{`${p.label}: ${p.avg}★ · ${p.count} task${p.count === 1 ? '' : 's'}`}</title>
          </circle>
          <text x={xOf(i)} y={yOf(p.avg ?? 1) - 7} textAnchor="middle" fill="currentColor" className="text-foreground" style={{ fontSize: 9, fontWeight: 700 }}>{p.avg}</text>
          <text x={xOf(i)} y={H - 5} textAnchor="middle" fill="currentColor" className="text-muted-foreground" style={{ fontSize: 9 }}>{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

// Throughput line — adds gridlines, a dashed weekly-avg reference, week ticks, and value labels
// on the peak + latest point. Uses theme primary via currentColor.
function ThroughputChart({ data, avg }: { data: number[]; avg: number }) {
  if (data.length < 2) return null;
  const W = 560, H = 150, padL = 22, padR = 14, padT = 18, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(...data), min = Math.min(...data);
  const top = max + 1, bot = Math.max(0, min - 1), range = top - bot || 1;
  const xOf = (i: number) => padL + (i / (data.length - 1)) * plotW;
  const yOf = (v: number) => padT + plotH - ((v - bot) / range) * plotH;
  const line = data.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  const area = `${xOf(0)},${yOf(bot)} ${line} ${xOf(data.length - 1)},${yOf(bot)}`;
  const peakIdx = data.indexOf(max);
  const ticks = [bot, Math.round((bot + top) / 2), top];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-primary" style={{ height: 'auto' }} role="img" aria-label="Throughput trend by week">
      <defs>
        <linearGradient id="thr-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="currentColor" className="text-border" strokeWidth={1} strokeOpacity={0.5} />
          <text x={padL - 5} y={yOf(t) + 3} textAnchor="end" fill="currentColor" className="text-muted-foreground" style={{ fontSize: 8 }}>{t}</text>
        </g>
      ))}
      <line x1={padL} y1={yOf(avg)} x2={W - padR} y2={yOf(avg)} stroke="currentColor" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.55} />
      <text x={W - padR} y={yOf(avg) - 4} textAnchor="end" fill="currentColor" className="text-muted-foreground" style={{ fontSize: 8, fontWeight: 600 }}>avg {avg}</text>
      <polygon points={area} fill="url(#thr-fill)" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => {
        const isPeak = i === peakIdx, isLast = i === data.length - 1;
        return (
          <g key={i}>
            <circle cx={xOf(i)} cy={yOf(v)} r={isLast ? 3.5 : 2} fill="currentColor">
              <title>{`Week ${i + 1}: ${v} tasks`}</title>
            </circle>
            {(isPeak || isLast) && (
              <text x={xOf(i)} y={yOf(v) - 7} textAnchor="middle" fill="currentColor" className="text-foreground" style={{ fontSize: 9, fontWeight: 700 }}>{v}</text>
            )}
            <text x={xOf(i)} y={H - 6} textAnchor="middle" fill="currentColor" className="text-muted-foreground" style={{ fontSize: 8 }}>W{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ReasonRow({ r, max }: { r: RevisionReason; max: number }) {
  return (
    <li className="text-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-medium">{r.label}</span>
        <span className="ml-auto text-xs font-semibold text-muted-foreground">{r.count}×</span>
      </div>
      <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(r.count / max) * 100}%` }} />
      </div>
      <p className="truncate text-[11px] text-muted-foreground" title={r.examples.map((e) => `${e.code}: ${e.note}`).join(' · ')}>
        e.g.{' '}
        <a href={`/staff/history/${r.examples[0].code}`} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:text-primary hover:underline">{r.examples[0].code}</a>
        {' '}— “{r.examples[0].note}”
      </p>
    </li>
  );
}

function CustomerRow({ c, max }: { c: CustomerWork; max: number }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
        {c.customer.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </span>
      <span className="w-28 shrink-0 truncate font-medium">{c.customer}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${(c.count / max) * 100}%` }} />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{c.count}</span>
      {c.avgRating !== null && <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"><i className="ph-fill ph-star text-amber-500" aria-hidden />{c.avgRating.toFixed(1)}</span>}
    </li>
  );
}
