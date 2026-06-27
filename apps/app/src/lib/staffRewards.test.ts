import { describe, it, expect } from 'vitest';
import { buildRewards, rewardsEarned, rewardsOnOffer, type RewardInputs } from './staffRewards';

const base: RewardInputs = {
  streakCurrent: 5, monthAvgRating: 4.2, monthRatedCount: 4,
  monthOnTimeRate: 80, monthFirstPassRate: 70, rank: 5, teamSize: 11, lifetimeTasks: 40,
};
const get = (i: RewardInputs, id: string) => buildRewards(i).find((r) => r.id === id)!;

describe('buildRewards — unlock conditions', () => {
  it('flawless streak unlocks at 20 in a row', () => {
    expect(get(base, 'streak').unlocked).toBe(false);
    expect(get({ ...base, streakCurrent: 20 }, 'streak').unlocked).toBe(true);
    expect(get({ ...base, streakCurrent: 10 }, 'streak').progressPct).toBe(50);
  });

  it('top-rated needs both the rating bar AND enough ratings', () => {
    expect(get({ ...base, monthAvgRating: 4.6, monthRatedCount: 4 }, 'rating').unlocked).toBe(true);
    // high rating but too few ratings → still locked, with a ratings hint
    const thin = get({ ...base, monthAvgRating: 5, monthRatedCount: 2 }, 'rating');
    expect(thin.unlocked).toBe(false);
    expect(thin.hint).toMatch(/more ratings/);
  });

  it('podium unlocks in the top 3 (lower rank is better)', () => {
    expect(get({ ...base, rank: 3 }, 'podium').unlocked).toBe(true);
    expect(get({ ...base, rank: 4 }, 'podium').unlocked).toBe(false);
    expect(get({ ...base, rank: 1 }, 'podium').progressPct).toBe(100);
  });

  it('on-time needs a perfect month; first-pass needs ≥90%', () => {
    expect(get({ ...base, monthOnTimeRate: 100 }, 'ontime').unlocked).toBe(true);
    expect(get({ ...base, monthOnTimeRate: 99 }, 'ontime').unlocked).toBe(false);
    expect(get({ ...base, monthFirstPassRate: 90 }, 'firstpass').unlocked).toBe(true);
  });

  it('centurion is a lifetime milestone at 100 tasks', () => {
    expect(get({ ...base, lifetimeTasks: 100 }, 'centurion').unlocked).toBe(true);
    expect(get({ ...base, lifetimeTasks: 50 }, 'centurion').progressPct).toBe(50);
  });

  it('progress is always clamped to 0–100', () => {
    for (const r of buildRewards({ ...base, streakCurrent: 999, monthOnTimeRate: 250, lifetimeTasks: 500 })) {
      expect(r.progressPct).toBeGreaterThanOrEqual(0);
      expect(r.progressPct).toBeLessThanOrEqual(100);
    }
  });
});

describe('reward totals', () => {
  it('splits earned vs on-offer by unlock state', () => {
    const all = buildRewards({ ...base, streakCurrent: 20, rank: 1, lifetimeTasks: 100 });
    const earned = rewardsEarned(all);
    const offer = rewardsOnOffer(all);
    const sum = all.reduce((a, r) => a + r.amount, 0);
    expect(earned + offer).toBe(sum);
    expect(earned).toBeGreaterThan(0);
  });
});
