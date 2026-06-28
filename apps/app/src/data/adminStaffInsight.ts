// Admin-facing staff insight aggregator.
// Combines the three pictures an admin/manager needs on one person into a single serializable
// bundle: PERFORMANCE (the same score model the staffer sees on /staff/performance), PAY (admin
// payroll from PAYOUTS + the commission wallet from /staff/finance), and CONDUCT (penalties +
// rewards). Admin legitimately sees money — unlike the staff surface, there is no money-leak
// invariant here — so payroll (base/commission/bonus/due, which derives from order value) and the
// commission wallet are shown side by side.
import { STAFF, PAYOUTS, ORDERS, managerOf, type OrderStatus, type Priority } from './adminMock';
import {
  workHistory, myWorkStats, earningsHistory, myEarningsSummary, myFinance, myPenalties, myRewards,
  myPayoutMethods, myPayouts, buildActivity,
  type ActivityBucket, type Granularity,
} from './staffMock';
import {
  rankByComposite, commissionTierFor, scoreBreakdown, improvementLever, firstPassStreak, ratingTrend,
  revisionReasons, tasksByCustomer,
  type TeamRank, type TierStanding, type ScoreBreakdown, type Lever, type WorkStats, type Streak,
  type RatingPoint, type MonthEarning, type EarningsSummary, type WorkItem, type RevisionReason,
  type CustomerWork,
} from '@/lib/staff';
import {
  summarisePenalties, buildLedger,
  type PenaltySummary, type StaffPenalty, type PayoutMethod, type PayoutRequest, type WalletEntry,
} from '@/lib/staffFinance';
import { rewardsEarned, rewardsOnOffer, type Reward } from '@/lib/staffRewards';

const REWARDS_MONTH = '2026-06';

export interface StaffPayroll {
  base: number; gig: number; commission: number; bonus: number; due: number;
  rate: number; basis: number; completedOrders: number; lastPaidAt: string | null;
  gigCounts: { service: string; count: number }[];
}
export interface StaffWallet { balance: number; available: number; clearing: number }
export interface StaffPenaltyBlock { summary: PenaltySummary; pendingCount: number; items: StaffPenalty[] }
export interface StaffRewardBlock { list: Reward[]; earned: number; onOffer: number; unlocked: number; total: number }

export interface StaffInsight {
  id: string; name: string; role: string; email: string; since: string; tz: string;
  active: boolean; skills: string[];
  managerId: string | null; managerName: string | null;
  // performance
  composite: number; quality: number; onTime: number; throughput: number; trend: number[];
  rank: TeamRank | null;
  tier: TierStanding;
  breakdown: ScoreBreakdown;
  lever: Lever | null;
  // track record
  stats: WorkStats;
  streak: Streak;
  ratings: RatingPoint[];
  history: WorkItem[];
  revisions: RevisionReason[];
  customers: CustomerWork[];
  // pay
  payroll: StaffPayroll;
  wallet: StaffWallet;
  earnings: EarningsSummary;
  earningsSeries: MonthEarning[];
  methods: PayoutMethod[];
  payouts: PayoutRequest[];
  ledger: WalletEntry[];
  // activity over time (tasks + pay bucketed by day/week/month/year)
  activity: Record<Granularity, ActivityBucket[]>;
  // conduct
  penalties: StaffPenaltyBlock;
  rewards: StaffRewardBlock;
}

// Resolve a staffer by id OR display name (orders store the name, not the id).
export function resolveStaffId(idOrName: string): string | null {
  return STAFF.find((s) => s.id === idOrName || s.name === idOrName)?.id ?? null;
}

// One pass → the whole admin picture for a staffer. Returns null for an unknown id.
export function buildStaffInsight(staffId: string): StaffInsight | null {
  const s = STAFF.find((x) => x.id === staffId);
  if (!s) return null;

  const history = workHistory(staffId);
  const stats = myWorkStats(staffId);
  const fin = myFinance(staffId);
  const penalties = myPenalties(staffId);
  const rewards = myRewards(staffId);
  const payout = PAYOUTS.find((p) => p.staffId === staffId);
  const mgr = managerOf(staffId);

  const breakdown = scoreBreakdown({ quality: s.quality, onTime: s.onTime, throughput: s.throughput }, s.composite);

  return {
    id: s.id, name: s.name, role: s.role, email: s.email, since: s.since, tz: s.tz,
    active: s.active, skills: s.skills,
    managerId: mgr?.id ?? null, managerName: mgr?.name ?? null,
    composite: s.composite, quality: s.quality, onTime: s.onTime, throughput: s.throughput, trend: s.trend,
    rank: rankByComposite(STAFF.map((x) => ({ id: x.id, composite: x.composite })), staffId),
    tier: commissionTierFor(s.composite),
    breakdown,
    lever: improvementLever({ quality: s.quality, onTime: s.onTime }),
    stats,
    streak: firstPassStreak(history),
    ratings: ratingTrend(history),
    history,
    revisions: revisionReasons(history),
    customers: tasksByCustomer(history),
    payroll: {
      base: payout?.base ?? 0, gig: payout?.gig ?? 0, commission: payout?.commission ?? 0, bonus: payout?.bonus ?? 0,
      due: payout?.due ?? 0, rate: payout?.rate ?? 0, basis: payout?.basis ?? 0, completedOrders: payout?.completedOrders ?? 0,
      gigCounts: payout?.gigCounts ?? [],
      lastPaidAt: payout?.lastPaidAt ?? null,
    },
    wallet: { balance: fin.balance, available: fin.available, clearing: fin.clearing },
    earnings: myEarningsSummary(staffId),
    earningsSeries: earningsHistory(staffId),
    methods: myPayoutMethods(staffId),
    payouts: [...myPayouts(staffId)].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    ledger: buildLedger(fin.credits, penalties, fin.payouts).slice(0, 12),
    activity: buildActivity(staffId),
    penalties: {
      summary: summarisePenalties(penalties, REWARDS_MONTH),
      pendingCount: fin.pendingFines,
      items: penalties,
    },
    rewards: {
      list: rewards, earned: rewardsEarned(rewards), onOffer: rewardsOnOffer(rewards),
      unlocked: rewards.filter((r) => r.unlocked).length, total: rewards.length,
    },
  };
}

// Lean roster-level summary for the staff LIST + hover card — the few extra signals worth showing
// next to each row without loading a full insight per card. Computed for every staffer.
export interface UpcomingTask { code: string; service: string; days: number; priority: Priority }
export interface StaffRosterSignals {
  id: string;
  tier: string;            // commission band label
  rank: number | null;     // team rank by composite
  teamSize: number;
  monthlyPay: number;      // base + commission + bonus (admin payroll, this cycle)
  walletBalance: number;
  pendingFines: number;    // penalties awaiting admin confirmation
  appliedFines: number;    // $ debited this record
  rewardsUnlocked: number;
  rewardsTotal: number;
  firstPassRate: number;   // % of archive delivered with no revision
  avgRating: number | null;
  // live workload (current in-flight orders + what's due in the next 3 days)
  activeLoad: number;
  overdue: number;
  dueSoon: number;         // active orders due within the next 3 days
  upcoming: UpcomingTask[]; // those due-soon items, soonest first
}

const ROSTER_TODAY = new Date('2026-06-24T00:00:00');
const ROSTER_ACTIVE = new Set<OrderStatus>(['assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered']);
const rosterDueIn = (d: string | null): number | null => (d ? Math.round((new Date(d).getTime() - ROSTER_TODAY.getTime()) / 86400000) : null);
export function rosterSignals(staffId: string): StaffRosterSignals | null {
  const s = STAFF.find((x) => x.id === staffId);
  if (!s) return null;
  const stats = myWorkStats(staffId);
  const fin = myFinance(staffId);
  const rewards = myRewards(staffId);
  const payout = PAYOUTS.find((p) => p.staffId === staffId);
  const rank = rankByComposite(STAFF.map((x) => ({ id: x.id, composite: x.composite })), staffId);
  const applied = fin.penalties.filter((p) => p.status === 'applied').reduce((a, p) => a + p.amount, 0);

  // Live workload from the order book (orders store the staff display name).
  const mine = ORDERS.filter((o) => o.staff === s.name && ROSTER_ACTIVE.has(o.status));
  const overdue = mine.filter((o) => (rosterDueIn(o.deadline) ?? 99) < 0).length;
  const upcoming: UpcomingTask[] = mine
    .map((o) => ({ code: o.code, service: o.service, days: rosterDueIn(o.deadline), priority: o.priority as Priority }))
    .filter((x): x is UpcomingTask => x.days !== null && x.days >= 0 && x.days <= 3)
    .sort((a, b) => a.days - b.days);

  return {
    id: s.id,
    tier: commissionTierFor(s.composite).current.level,
    rank: rank?.rank ?? null,
    teamSize: STAFF.length,
    monthlyPay: payout?.due ?? 0,
    walletBalance: fin.balance,
    pendingFines: fin.pendingFines,
    appliedFines: applied,
    rewardsUnlocked: rewards.filter((r) => r.unlocked).length,
    rewardsTotal: rewards.length,
    firstPassRate: stats.firstPassRate,
    avgRating: stats.avgRating,
    activeLoad: mine.length,
    overdue,
    dueSoon: upcoming.length,
    upcoming: upcoming.slice(0, 4),
  };
}
