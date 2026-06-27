// Staff rewards — pure types + logic for the bonus/achievement mechanism on the Finance page.
// Each reward pays a bonus into the commission wallet when unlocked; until then a progress bar
// shows how close the staffer is. Computed entirely from existing performance signals (streaks,
// ratings, ranking, lifetime volume) — no new money concepts, money-leak-safe.

export type RewardKind = 'streak' | 'monthly' | 'ranking' | 'milestone';

export interface Reward {
  id: string;
  title: string;
  blurb: string;
  icon: string;
  kind: RewardKind;
  amount: number;          // bonus paid into the wallet on unlock
  current: number;         // progress value
  target: number;          // value needed to unlock
  unit: string;            // label for current/target, e.g. "in a row", "% on-time"
  unlocked: boolean;
  progressPct: number;     // 0–100, clamped
  hint: string;            // "Earned" / "3 to go" / "needs 2 more ratings"
}

export const REWARD_KIND_META: Record<RewardKind, { label: string; tone: string }> = {
  streak: { label: 'Streak', tone: 'text-orange-500' },
  monthly: { label: 'This month', tone: 'text-primary' },
  ranking: { label: 'Team', tone: 'text-violet-500' },
  milestone: { label: 'Milestone', tone: 'text-amber-500' },
};

export interface RewardInputs {
  streakCurrent: number;       // consecutive no-revision deliveries
  monthAvgRating: number | null;
  monthRatedCount: number;
  monthOnTimeRate: number;     // %
  monthFirstPassRate: number;  // %
  rank: number;                // 1-based team rank by composite
  teamSize: number;
  lifetimeTasks: number;
}

const MIN_RATED = 3;       // ratings needed before the Top-Rated reward can judge a month
const PODIUM = 3;          // top-N for the ranking reward

const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export function buildRewards(i: RewardInputs): Reward[] {
  const rewards: Reward[] = [];

  // 1. Flawless streak — consecutive deliveries with zero revisions.
  {
    const target = 20;
    const unlocked = i.streakCurrent >= target;
    const remaining = Math.max(0, target - i.streakCurrent);
    rewards.push({
      id: 'streak', title: 'Flawless Streak', blurb: `${target} deliveries in a row with no revision`,
      icon: 'ph-fire', kind: 'streak', amount: 80,
      current: i.streakCurrent, target, unit: 'in a row',
      unlocked, progressPct: clampPct((i.streakCurrent / target) * 100),
      hint: unlocked ? 'Earned' : `${remaining} to go`,
    });
  }

  // 2. Top rated — average rating this month at or above the bar.
  {
    const target = 4.5;
    const avg = i.monthAvgRating ?? 0;
    const enoughRatings = i.monthRatedCount >= MIN_RATED;
    const unlocked = enoughRatings && avg >= target;
    rewards.push({
      id: 'rating', title: 'Top Rated', blurb: `Average rating ≥ ${target} this month`,
      icon: 'ph-star', kind: 'monthly', amount: 60,
      current: Math.round(avg * 10) / 10, target, unit: '★ avg',
      unlocked, progressPct: clampPct((avg / target) * 100),
      hint: unlocked ? 'Earned' : !enoughRatings ? `${MIN_RATED - i.monthRatedCount} more ratings needed` : `${(Math.round((target - avg) * 10) / 10)}★ to go`,
    });
  }

  // 3. Podium — finish the month in the top 3 by composite (lower rank is better).
  {
    const unlocked = i.rank > 0 && i.rank <= PODIUM;
    rewards.push({
      id: 'podium', title: 'Podium', blurb: `Finish the month Top ${PODIUM} on the team`,
      icon: 'ph-trophy', kind: 'ranking', amount: 100,
      current: i.rank, target: PODIUM, unit: `of ${i.teamSize}`,
      unlocked, progressPct: unlocked ? 100 : clampPct((PODIUM / Math.max(i.rank, 1)) * 100),
      hint: unlocked ? `Earned · #${i.rank}` : `#${i.rank} now · reach top ${PODIUM}`,
    });
  }

  // 4. On the dot — perfect on-time delivery this month.
  {
    const target = 100;
    const unlocked = i.monthOnTimeRate >= target;
    rewards.push({
      id: 'ontime', title: 'On the Dot', blurb: '100% on-time delivery this month',
      icon: 'ph-clock-countdown', kind: 'monthly', amount: 50,
      current: i.monthOnTimeRate, target, unit: '% on-time',
      unlocked, progressPct: clampPct(i.monthOnTimeRate),
      hint: unlocked ? 'Earned' : `${target - i.monthOnTimeRate}% to go`,
    });
  }

  // 5. Clean sweep — high first-pass rate this month.
  {
    const target = 90;
    const unlocked = i.monthFirstPassRate >= target;
    rewards.push({
      id: 'firstpass', title: 'Clean Sweep', blurb: `≥ ${target}% first-pass this month`,
      icon: 'ph-seal-check', kind: 'monthly', amount: 40,
      current: i.monthFirstPassRate, target, unit: '% first-pass',
      unlocked, progressPct: clampPct((i.monthFirstPassRate / target) * 100),
      hint: unlocked ? 'Earned' : `${Math.max(0, target - i.monthFirstPassRate)}% to go`,
    });
  }

  // 6. Centurion — lifetime delivery milestone.
  {
    const target = 100;
    const unlocked = i.lifetimeTasks >= target;
    rewards.push({
      id: 'centurion', title: 'Centurion', blurb: '100 tasks delivered, all-time',
      icon: 'ph-medal', kind: 'milestone', amount: 120,
      current: i.lifetimeTasks, target, unit: 'tasks',
      unlocked, progressPct: clampPct((i.lifetimeTasks / target) * 100),
      hint: unlocked ? 'Earned' : `${target - i.lifetimeTasks} to go`,
    });
  }

  return rewards;
}

export function rewardsEarned(rewards: Reward[]): number {
  return rewards.filter((r) => r.unlocked).reduce((a, r) => a + r.amount, 0);
}
export function rewardsOnOffer(rewards: Reward[]): number {
  return rewards.filter((r) => !r.unlocked).reduce((a, r) => a + r.amount, 0);
}
