import { MyDayClient, type OverviewData } from '@/components/staff/MyDayClient';
import {
  myTasks, myEarnings, myManager, managerThread, latestReview, myCustomers,
  myFinance, myRewards, myPenalties, myWorkStats, workHistory,
} from '@/data/staffMock';
import { STAFF } from '@/data/adminMock';
import { currentStaffIdentity } from '@/lib/currentStaff';
import { summarisePenalties } from '@/lib/staffFinance';
import { rewardsEarned } from '@/lib/staffRewards';
import { daysToDue, PRIORITY_RANK, commissionTierFor, firstPassStreak } from '@/lib/staff';
import type { MyDayTask } from '@/lib/myDay';

const ACTIONABLE = new Set(['assigned', 'in_progress', 'changes_requested']);

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function MyDayPage() {
  const { id: sid, name } = await currentStaffIdentity();
  const tasks = myTasks(sid);
  const CAPACITY = STAFF.find((s) => s.id === sid)?.capacity ?? 6;
  const focus: MyDayTask[] = tasks
    .filter((t) => ACTIONABLE.has(t.status))
    .map((t) => ({ id: t.id, code: t.code, service: t.service, pkg: t.pkg, status: t.status, priority: t.priority, days: daysToDue(t.deadline) }))
    .sort((a, b) => (a.days ?? 99) - (b.days ?? 99) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const firstName = name.split(' ')[0];

  // Overview data computed server-side; only the staffer's OWN slice is passed to the client.
  const m = myManager(sid);
  const lastMsg = managerThread(m.id).at(-1);
  const me = STAFF.find((s) => s.id === sid);

  const finance = myFinance(sid);
  const tier = commissionTierFor(me?.composite ?? 0);
  const rewards = myRewards(sid);
  const nextReward = rewards.filter((r) => !r.unlocked).sort((a, b) => b.progressPct - a.progressPct)[0] ?? null;
  const pen = summarisePenalties(myPenalties(sid), '2026-06');
  const work = myWorkStats(sid);
  const streak = firstPassStreak(workHistory(sid)).current;

  // Deadlines landing in the next 7 days (planning preview) — every board task, not just actionable.
  const upcoming = tasks
    .filter((t) => t.status !== 'completed' && t.status !== 'canceled' && t.deadline)
    .map((t) => ({ code: t.code, service: t.service, days: daysToDue(t.deadline) }))
    .filter((t): t is { code: string; service: string; days: number } => t.days !== null && t.days >= 0 && t.days <= 7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  const overview: OverviewData = {
    earnings: myEarnings(sid),
    manager: { name: m.name, title: m.title, message: lastMsg?.body ?? m.note, at: lastMsg?.at ?? null },
    review: latestReview(sid),
    customers: myCustomers(sid),
    onTime: me?.onTime ?? 0,
    wallet: { available: finance.available, balance: finance.balance },
    tier: { level: tier.current.level, mult: tier.current.mult, nextLevel: tier.next?.level ?? null, toNext: tier.toNext },
    reward: nextReward ? { title: nextReward.title, progressPct: nextReward.progressPct, hint: nextReward.hint, amount: nextReward.amount } : null,
    earnedBonus: rewardsEarned(rewards),
    fines: { pending: pen.pending, pendingTotal: pen.pendingTotal, appliedTotal: pen.appliedTotal },
    upcoming,
    streak,
    avgCommission: work.avgCommission ?? 0,
  };

  return (
    <MyDayClient
      greeting={`${greeting(new Date().getHours())}, ${firstName}`}
      capacity={CAPACITY}
      everHadTasks={tasks.length > 0}
      initialFocus={focus}
      overview={overview}
    />
  );
}
