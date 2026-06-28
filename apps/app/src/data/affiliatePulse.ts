// Affiliate FOMO layer — the urgency signals that make a partner want to act NOW:
// leaderboard rank, a time-boxed challenge, a live activity feed, and program-wide
// social proof. Mock + deterministic.
//
// Money-leak invariant: peer numbers are AGGREGATE / ANONYMISED program stats only.
// Nothing here exposes another partner's full identity, staff pay, or platform margin.

// ---- Leaderboard rank ----
export interface RankInfo {
  rank: number;
  total: number;
  percentile: number;   // top X% (smaller = better)
  aheadGap: number;     // USD of commission to overtake the partner one rank up
  aheadName: string;    // anonymised handle of the partner just ahead
  trend: number;        // rank places moved this month (+ = climbed)
}

export const myRank = (): RankInfo => ({
  rank: 6,
  total: 142,
  percentile: 4,
  aheadGap: 380,
  aheadName: 'mar****@yt',
  trend: 2,
});

// ---- Monthly challenge (time-boxed bonus) ----
export interface Challenge {
  label: string;
  current: number;
  goal: number;
  reward: number;     // USD bonus on completion
  endsAt: string;     // ISO date the window closes
  unit: string;       // 'referrals', 'orders', etc.
}

export const monthlyChallenge = (): Challenge => ({
  label: 'June sprint',
  current: 2,
  goal: 3,
  reward: 250,
  endsAt: '2026-06-30T23:59:59',
  unit: 'new referrals',
});

// ---- Live activity feed ----
export type ActivityKind = 'commission' | 'signup' | 'tier' | 'peer' | 'payout';
export interface Activity {
  id: string;
  kind: ActivityKind;
  text: string;
  amount?: number;
  ago: string;     // human relative time
  mine: boolean;   // styles "your" events distinctly
}

export const recentActivity = (): Activity[] => [
  { id: 'ac1', kind: 'commission', text: 'Bolt Media placed an order', amount: 380, ago: '2h ago', mine: true },
  { id: 'ac2', kind: 'peer', text: 'A partner in your niche just earned', amount: 1240, ago: '4h ago', mine: false },
  { id: 'ac3', kind: 'commission', text: 'Forge Studio placed an order', amount: 880, ago: 'yesterday', mine: true },
  { id: 'ac4', kind: 'signup', text: 'Glint App signed up via your link', ago: 'yesterday', mine: true },
  { id: 'ac5', kind: 'peer', text: '7 new partners joined today', ago: '1d ago', mine: false },
  { id: 'ac6', kind: 'payout', text: 'A top partner withdrew', amount: 4200, ago: '2d ago', mine: false },
];

// ---- Program-wide social proof (for the public join page) ----
export interface ProgramStats {
  partners: number;
  paidLastMonth: number;   // total commission paid to all partners last month
  topEarnerMonth: number;  // what the #1 partner earned last month
  avgActiveMonth: number;  // average active partner's monthly commission
}

export const programStats = (): ProgramStats => ({
  partners: 1284,
  paidLastMonth: 348_200,
  topEarnerMonth: 9_640,
  avgActiveMonth: 720,
});

// Anonymised recent payouts, for a scrolling ticker on the join page.
export interface PayoutTick { who: string; amount: number; ago: string }
export const recentPayoutTicks = (): PayoutTick[] => [
  { who: 'Jane R.', amount: 480, ago: '2m ago' },
  { who: 'Marco V.', amount: 1_200, ago: '11m ago' },
  { who: 'Aïsha K.', amount: 760, ago: '24m ago' },
  { who: 'Devin L.', amount: 2_050, ago: '38m ago' },
  { who: 'Priya N.', amount: 640, ago: '52m ago' },
  { who: 'Tomás G.', amount: 1_540, ago: '1h ago' },
];

// A scarcity hook: a limited-time perk for joining now.
export interface JoinOffer { headline: string; detail: string; endsAt: string }
export const joinOffer = (): JoinOffer => ({
  headline: 'Launch boost — start at Silver (15%)',
  detail: 'Sign up this month and skip Bronze. Your first 90 days pay the Silver rate.',
  endsAt: '2026-06-30T23:59:59',
});
