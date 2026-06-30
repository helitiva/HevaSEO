'use client';

import { useMemo, useState } from 'react';
import { SlideOver } from '@/components/shared/SlideOver';
import { KpiTile } from '@/components/shared/KpiTile';
import { money } from '@/data/adminMock';
import type { StaffEarnings, StaffFinance } from '@/data/staffMock';
import type { MonthEarning, EarningsSummary } from '@/lib/staff';
import {
  walletBalance, availableToWithdraw, clearingTotal, pendingPenaltyCount, buildLedger, withdrawalFee,
  summarisePenalties, maskTail, maskEmail, METHOD_DEFAULTS,
  PENALTY_TYPE_META, PENALTY_STATUS_META, PAYOUT_STATUS_META, PAYOUT_METHOD_META, WALLET_KIND_META,
  type StaffPenalty, type PayoutRequest, type WalletEntry, type PenaltyRule, type PayoutMethod, type PayoutMethodKind, type Payslip,
} from '@/lib/staffFinance';
import { rewardsEarned, rewardsOnOffer, REWARD_KIND_META, type Reward } from '@/lib/staffRewards';
import { requestPayoutAction, disputePenaltyAction, addPayoutMethodAction, setDefaultMethodAction, removeMethodAction } from './payout.actions';
import { MOCK_TODAY } from '@/lib/today';

const MIN_PAYOUT = 50;
const TODAY = MOCK_TODAY;

// Signed currency for the ledger — credits read "+$x", debits "−$x".
const signed = (n: number): string => `${n < 0 ? '−' : '+'}${money(Math.abs(n))}`;

type Props = {
  earnings: StaffEarnings;
  history: MonthEarning[];
  summary: EarningsSummary;
  finance: StaffFinance;
  rewards?: Reward[];
  firstPassRate: number;
  /** KPI rewards/bonuses are a delivery-STAFF mechanism; managers hide this section. */
  showRewards?: boolean;
  /** 'manager' relabels the payroll card (salary + pod-override commission, no gig/bonus line). */
  payStyle?: 'staff' | 'manager';
  /** Lane D inc-D2: a real provisioned staffer's DB wallet (balance + ledger) overrides the mock-derived
   *  balance + activity feed. null → fall back to mock (demo / admin-impersonation / never-paid). */
  realWallet?: { balance: number; ledger: WalletEntry[]; methods: PayoutMethod[]; payouts: PayoutRequest[]; penalties: StaffPenalty[]; payslips: Payslip[] } | null;
};

const REWARDS_MONTH = '2026-06';

const TABS = [
  { key: 'activity', label: 'Activity', icon: 'ph-list-bullets' },
  { key: 'penalties', label: 'Penalties', icon: 'ph-warning-octagon' },
  { key: 'payslips', label: 'Payslips', icon: 'ph-receipt' },
  { key: 'payouts', label: 'Payouts', icon: 'ph-hand-coins' },
] as const;

export function FinanceClient({ earnings, history, summary, finance, rewards = [], firstPassRate, showRewards = true, payStyle = 'staff', realWallet = null }: Props) {
  const isManager = payStyle === 'manager';
  // Penalties + payouts are session-mutable (dispute a fine, request a payout); everything else is read-only.
  const [penalties, setPenalties] = useState<StaffPenalty[]>(realWallet ? realWallet.penalties : finance.penalties);
  const [payouts, setPayouts] = useState<PayoutRequest[]>(realWallet ? realWallet.payouts : finance.payouts);
  const [methods, setMethods] = useState<PayoutMethod[]>(realWallet && realWallet.methods.length ? realWallet.methods : finance.methods);
  // real wallet balance held in state so a payout request reflects optimistically (debit) before reload
  const [realBalance, setRealBalance] = useState(realWallet?.balance ?? 0);
  const [tab, setTab] = useState<string>('activity');
  const [requestOpen, setRequestOpen] = useState(false);
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [disputeTarget, setDisputeTarget] = useState<StaffPenalty | null>(null);
  const [toast, setToast] = useState('');

  const { credits, rules } = finance;

  const mockBalance = useMemo(() => walletBalance(credits, penalties, payouts), [credits, penalties, payouts]);
  const mockAvailable = useMemo(() => availableToWithdraw(credits, penalties, payouts), [credits, penalties, payouts]);
  const mockClearing = useMemo(() => clearingTotal(credits), [credits]);
  const pendingFines = useMemo(() => pendingPenaltyCount(penalties), [penalties]);
  const mockLedger = useMemo(() => buildLedger(credits, penalties, payouts), [credits, penalties, payouts]);

  // Real DB wallet overrides the mock-derived balance + activity feed when the signed-in user is a
  // provisioned staffer (Lane D inc-D2). Clearing windows aren't modelled in the DB yet → all cleared.
  const balance = realWallet ? realBalance : mockBalance;
  const available = realWallet ? realBalance : mockAvailable;
  const clearing = realWallet ? 0 : mockClearing;
  const ledger = realWallet ? realWallet.ledger : mockLedger;

  const payday = nextPayday(TODAY);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400); };

  const submitPayout = async (amount: number, methodId: string, note: string) => {
    // Real wallet: the staffer's session calls request_payout (atomic debit + request). Optimistically
    // reflect it (debit balance + add the row) so the UI updates without a reload.
    if (realWallet) {
      const res = await requestPayoutAction(amount, methodId || null);
      if (!res.ok) { showToast(res.error); return; }
      setRealBalance((b) => b - amount);
    }
    setPayouts((prev) => [
      { id: `po-${Date.now()}`, amount, methodId, status: 'requested', requestedAt: TODAY, note: note || undefined },
      ...prev,
    ]);
    setRequestOpen(false);
    setTab('payouts');
    showToast(`Payout of ${money(amount)} requested — admin will review it.`);
  };

  const submitDispute = async (id: string, note: string) => {
    if (realWallet) {
      const res = await disputePenaltyAction(id, note);
      if (!res.ok) { showToast(res.error); return; }
    }
    setPenalties((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'disputed', disputeNote: note } : p)));
    setDisputeTarget(null);
    showToast('Dispute sent — an admin will review it.');
  };

  const addMethod = async (m: Omit<PayoutMethod, 'id' | 'isDefault'>, makeDefault: boolean) => {
    if (realWallet) {
      // real: add_payout_method writes the row (claims-derived); the action revalidates the page. Update
      // local state optimistically so it shows immediately (the first method always becomes default).
      const res = await addPayoutMethodAction(m.kind, m.label, makeDefault);
      if (!res.ok) { showToast(res.error); return; }
    }
    setMethods((prev) => {
      const first = prev.length === 0;
      const isDefault = makeDefault || first;
      const next: PayoutMethod = { ...m, id: `pm-${Date.now()}`, isDefault };
      return isDefault ? [...prev.map((x) => ({ ...x, isDefault: false })), next] : [...prev, next];
    });
    setAddMethodOpen(false);
    showToast('Payment method added.');
  };
  const setDefaultMethod = async (id: string) => {
    if (realWallet) {
      const res = await setDefaultMethodAction(id);
      if (!res.ok) { showToast(res.error); return; }
    }
    setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
    showToast('Default payout method updated.');
  };
  const removeMethod = async (id: string) => {
    if (realWallet) {
      const res = await removeMethodAction(id);
      if (!res.ok) { showToast(res.error); return; }
    }
    setMethods((prev) => {
      const next = prev.filter((m) => m.id !== id);
      // If we removed the default, promote the first remaining method.
      if (next.length && !next.some((m) => m.isDefault)) next[0] = { ...next[0], isDefault: true };
      return next;
    });
    showToast('Payment method removed.');
  };

  return (
    <div className="space-y-4">
      {/* ── Hero: commission wallet (left) + base-salary payroll (right) ── */}
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 p-4 shadow-sm transition hover:-translate-y-0.5 bg-gradient-to-br from-violet-600 to-primary text-white">
          <div className="relative">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/80">
              <i className="ph-bold ph-wallet" aria-hidden /> Commission wallet · available
            </p>
            <p className="display mt-1 text-4xl font-bold tracking-tight">{money(available)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRequestOpen(true)}
                disabled={available < MIN_PAYOUT}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-bold text-violet-700 shadow-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <i className="ph-bold ph-arrow-circle-down" aria-hidden /> Request payout
              </button>
              {clearing > 0 && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90">
                  {money(clearing)} clearing
                </span>
              )}
            </div>
            <p className="mt-3 text-[11px] text-white/70">
              Balance {money(balance)} · {isManager ? 'your pod-override commission accrues here each cycle (salary is paid automatically).' : 'commission accrues here as your work is billed.'} {MIN_PAYOUT > 0 && `Minimum payout ${money(MIN_PAYOUT)}.`}
            </p>
          </div>
        </div>

        <div className="kcard flex flex-col justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <i className="ph-bold ph-calendar-check text-primary" aria-hidden /> {isManager ? 'Salary + override · payroll' : 'Salary + gig · payroll'}
            </p>
            <p className="display mt-1 text-2xl font-bold">{money(earnings.takeHome)}<span className="text-sm font-medium text-muted-foreground">/mo</span></p>
          </div>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fixed salary</span>
              <span className="font-semibold tabular-nums">{money(earnings.base)}</span>
            </div>
            {!isManager && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gig pay <span className="text-xs">· {earnings.gigUnits} gig{earnings.gigUnits === 1 ? '' : 's'} delivered</span></span>
                <span className="font-semibold tabular-nums">{earnings.gig ? `+${money(earnings.gig)}` : money(0)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{isManager ? 'Pod-override commission' : 'Commission + bonus'}</span>
              <span className="font-semibold tabular-nums">{money(isManager ? earnings.commission : earnings.commission + earnings.bonus)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="text-muted-foreground">Next payday</span>
              <span className="font-semibold">{payday.label} <span className="text-xs font-normal text-muted-foreground">· in {payday.days}d</span></span>
            </div>
            {earnings.lastPaid && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last paid</span>
                <span className="font-medium">{earnings.lastPaid.month} · {money(earnings.lastPaid.amount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="text-muted-foreground">Paid automatically</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500"><i className="ph-bold ph-check-circle" aria-hidden /> no action needed</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile icon="ph-coins" label="This month take-home" value={money(earnings.takeHome)} hint="salary + gig + commission + bonus" tone="good" />
        <KpiTile icon="ph-chart-line-up" label="Year to date" value={money(summary.ytd)} hint={`${history.length} months`} />
        <KpiTile icon="ph-seal-check" label="First-pass rate" value={`${firstPassRate}%`} hint="fewer fines" tone={firstPassRate >= 80 ? 'good' : 'warn'} />
        <KpiTile icon="ph-warning-octagon" label="Pending fines" value={String(pendingFines)} hint={pendingFines ? 'review in Penalties' : 'all clear'} tone={pendingFines ? 'warn' : 'good'} />
      </div>

      {/* ── Earnings trend ── */}
      <div className="kcard">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-bar text-primary" aria-hidden /> Variable pay · last {history.length} months</p>
          <span className="hidden text-xs text-muted-foreground sm:inline">commission + bonus per month</span>
        </div>
        <EarningsBars history={history} />
      </div>

      {/* ── Rewards & bonuses (delivery-staff KPI mechanism; hidden for managers) ── */}
      {showRewards && <RewardsPanel rewards={rewards} />}

      {/* ── Tabbed detail ── */}
      <div className="inline-flex flex-wrap rounded-lg border border-border p-0.5">
        {TABS.map((t) => {
          const badge = t.key === 'penalties' && pendingFines ? pendingFines : null;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <i className={`ph-bold ${t.icon}`} aria-hidden /> {t.label}
              {badge !== null && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{badge}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'activity' && <ActivityTab ledger={ledger} />}
      {tab === 'penalties' && <PenaltiesTab penalties={penalties} rules={rules} onDispute={setDisputeTarget} />}
      {tab === 'payslips' && <PayslipsTab history={history} base={earnings.base} payslips={realWallet?.payslips ?? null} />}
      {tab === 'payouts' && (
        <PayoutsTab
          payouts={payouts}
          methods={methods}
          onRequest={() => setRequestOpen(true)}
          onAddMethod={() => setAddMethodOpen(true)}
          onSetDefault={setDefaultMethod}
          onRemove={removeMethod}
        />
      )}

      {requestOpen && (
        <RequestPayoutForm available={available} methods={methods} onClose={() => setRequestOpen(false)} onSubmit={submitPayout} onAddMethod={() => { setRequestOpen(false); setAddMethodOpen(true); }} />
      )}
      {addMethodOpen && (
        <AddMethodForm onClose={() => setAddMethodOpen(false)} onSubmit={addMethod} />
      )}
      {disputeTarget && (
        <DisputeForm penalty={disputeTarget} onClose={() => setDisputeTarget(null)} onSubmit={submitDispute} />
      )}

      {toast && (
        <div className="toast-in fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">{toast}</div>
      )}
    </div>
  );
}

// ── Rewards & bonuses ─────────────────────────────────────────────────────────
function RewardsPanel({ rewards }: { rewards: Reward[] }) {
  const earned = rewardsEarned(rewards);
  const onOffer = rewardsOnOffer(rewards);
  const unlockedCount = rewards.filter((r) => r.unlocked).length;
  return (
    <div className="kcard">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-gift text-violet-500" aria-hidden /> Rewards &amp; bonuses</p>
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-emerald-500">{money(earned)} earned</span> · {money(onOffer)} on offer
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Hit a target and the bonus drops into your wallet. {unlockedCount} of {rewards.length} unlocked.</p>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((r) => <RewardCard key={r.id} r={r} />)}
      </div>
    </div>
  );
}

function RewardCard({ r }: { r: Reward }) {
  const kindMeta = REWARD_KIND_META[r.kind];
  return (
    <div className={`relative flex flex-col rounded-xl border p-3 transition ${r.unlocked ? 'border-emerald-500/50 bg-emerald-500/[0.06]' : 'border-border hover:border-primary/40'}`}>
      <div className="mb-2 flex items-start gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${r.unlocked ? 'bg-emerald-500/15 text-emerald-500' : 'bg-violet-500/10 text-violet-500'}`}>
          <i className={`ph-bold ${r.unlocked ? 'ph-check-circle' : r.icon}`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold leading-tight">{r.title}</p>
          <p className="text-[11px] text-muted-foreground">{r.blurb}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.unlocked ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'}`}>+{money(r.amount)}</span>
      </div>
      {/* progress bar — the "loading bar" toward the reward */}
      <div className="mt-auto">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className={`font-semibold uppercase tracking-wide ${kindMeta.tone}`}>{kindMeta.label}</span>
          <span className={r.unlocked ? 'font-semibold text-emerald-500' : 'text-muted-foreground'}>
            {r.unlocked ? <><i className="ph-bold ph-seal-check mr-0.5" aria-hidden />{r.hint}</> : r.hint}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={r.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.title} progress`}>
          <div className={`h-full rounded-full transition-all ${r.unlocked ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-500 to-primary'}`} style={{ width: `${r.progressPct}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {r.kind === 'ranking' ? `rank #${r.current} ${r.unit}` : `${r.current} / ${r.target} ${r.unit}`}
        </p>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'bad' | 'warn' | 'good' | 'muted' }) {
  const color = tone === 'bad' ? 'text-rose-500' : tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-500' : '';
  return (
    <div className="rounded-xl border border-border p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`display text-lg font-bold ${color}`}>{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

// ── Activity ledger ─────────────────────────────────────────────────────────
function ActivityTab({ ledger }: { ledger: WalletEntry[] }) {
  if (ledger.length === 0) return <Empty icon="ph-tray" text="No wallet activity yet." />;
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 font-semibold">Entry</th>
            <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Task</th>
            <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Date</th>
            <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {ledger.map((e) => {
            const m = WALLET_KIND_META[e.kind];
            const credit = e.amount >= 0;
            return (
              <tr key={e.id} className="border-b border-border/50 transition last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${credit ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}><i className={`ph-bold ${m.icon}`} aria-hidden /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.label}</span>
                      {e.pending && <span className="text-[11px] text-amber-600 dark:text-amber-400">clearing</span>}
                    </span>
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">{e.taskCode ?? '—'}</td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground sm:table-cell">{e.at}</td>
                <td className={`px-3 py-2.5 text-right font-semibold ${credit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{signed(e.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Penalties ───────────────────────────────────────────────────────────────
function PenaltiesTab({ penalties, rules, onDispute }: { penalties: StaffPenalty[]; rules: PenaltyRule[]; onDispute: (p: StaffPenalty) => void }) {
  const total = penalties.filter((p) => p.status === 'applied').reduce((a, p) => a + p.amount, 0);
  const summary = summarisePenalties(penalties, REWARDS_MONTH);
  return (
    <div className="space-y-3">
      {/* Summary roll-up: status totals + breakdown by reason */}
      {penalties.length > 0 && (
        <div className="kcard">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-donut text-primary" aria-hidden /> Penalty summary</p>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryStat label="Applied" value={`−${money(summary.appliedTotal)}`} sub={`${summary.applied} fine${summary.applied === 1 ? '' : 's'}`} tone="bad" />
            <SummaryStat label="Pending" value={summary.pendingTotal ? `−${money(summary.pendingTotal)}` : money(0)} sub={`${summary.pending} to review`} tone={summary.pending ? 'warn' : 'muted'} />
            <SummaryStat label="This month" value={summary.monthTotal ? `−${money(summary.monthTotal)}` : money(0)} sub="applied" tone={summary.monthTotal ? 'warn' : 'muted'} />
            <SummaryStat label="Waived" value={String(summary.waived)} sub="forgiven" tone="good" />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">By reason</p>
          <ul className="space-y-2">
            {summary.byType.map((t) => {
              const meta = PENALTY_TYPE_META[t.type];
              const max = summary.byType[0]?.amount || summary.byType[0]?.count || 1;
              const basis = summary.byType[0]?.amount ? t.amount : t.count;
              return (
                <li key={t.type} className="text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <i className={`ph-bold ${meta.icon} text-amber-500`} aria-hidden />
                    <span className="font-medium">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">{t.count}×</span>
                    <span className="ml-auto text-xs font-semibold">{t.amount ? `−${money(t.amount)}` : '—'}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((basis / max) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{meta.blurb}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* How fines work */}
      <div className="kcard">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-scales text-primary" aria-hidden /> How penalties work</p>
        <p className="mb-3 text-sm text-muted-foreground">A rule flags a fine, your manager reviews it, and only then does it leave your wallet. You can dispute anything that looks wrong.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {rules.map((r) => {
            const meta = PENALTY_TYPE_META[r.type];
            const size = r.sizing === 'pct' ? `${r.value}% of commission` : r.sizing === 'progressive' ? `from ${r.value}%, escalating` : `${money(r.value)} flat`;
            return (
              <div key={r.type} className="rounded-xl border border-border p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><i className={`ph-bold ${meta.icon} text-amber-500`} aria-hidden /> {r.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.threshold}</p>
                <p className="mt-1.5 text-xs font-semibold text-foreground">{size}</p>
              </div>
            );
          })}
        </div>
      </div>

      {penalties.length === 0 ? (
        <Empty icon="ph-confetti" text="No penalties on record — clean work. 🎯" />
      ) : (
        <>
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>{penalties.length} penalt{penalties.length === 1 ? 'y' : 'ies'} on record</span>
            <span>Applied total: <span className="font-semibold text-rose-500">−{money(total)}</span></span>
          </div>
          <ul className="space-y-2">
            {penalties.map((p) => <PenaltyRow key={p.id} p={p} onDispute={onDispute} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function PenaltyRow({ p, onDispute }: { p: StaffPenalty; onDispute: (p: StaffPenalty) => void }) {
  const meta = PENALTY_TYPE_META[p.type];
  const st = PENALTY_STATUS_META[p.status];
  const canDispute = p.status === 'pending' || p.status === 'applied';
  return (
    <li className={`kcard ${p.status === 'pending' ? 'border-l-[3px] border-l-amber-500' : ''}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-500"><i className={`ph-bold ${meta.icon}`} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{meta.label}</p>
            {p.taskCode && <span className="font-mono text-[11px] text-muted-foreground">{p.taskCode}</span>}
            <span className={`pill ${st.pill}`}>{st.label}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{p.reason}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{p.detail} · flagged {p.createdAt} · {p.by}</p>
          {p.disputeNote && <p className="mt-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs italic">Your dispute: “{p.disputeNote}”</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`display text-lg font-bold ${p.status === 'waived' ? 'text-muted-foreground line-through' : 'text-rose-500'}`}>−{money(p.amount)}</span>
          {canDispute && (
            <button onClick={() => onDispute(p)} className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold transition hover:border-primary/60 hover:bg-accent">
              <i className="ph-bold ph-flag mr-1" aria-hidden />Dispute
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ── Payslips (monthly pay archive) ────────────────────────────────────────────
// When real payslips (posted payroll runs) exist, show them — fixed pay (salary + gig + bonus) per
// period; the variable commission lives in the wallet (Activity / Payouts), not here. Otherwise the
// mock monthly archive is shown (demo / never-run-payroll).
function PayslipsTab({ history, base, payslips }: { history: MonthEarning[]; base: number; payslips: Payslip[] | null }) {
  if (payslips && payslips.length > 0) {
    return (
      <div className="kcard">
        <div className="mb-2 flex items-end justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-receipt text-primary" aria-hidden /> Payroll runs</p>
          <span className="text-[11px] text-muted-foreground">Fixed pay per period · commission is in your wallet</span>
        </div>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-2">Period</th>
                <th className="px-2 text-right">Salary</th>
                <th className="px-2 text-right">Gig</th>
                <th className="px-2 text-right">Bonus</th>
                <th className="py-1.5 pl-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p, i) => (
                <tr key={p.id} className={`border-b border-border/50 last:border-0 ${i === 0 ? 'bg-emerald-500/[0.06]' : ''}`}>
                  <td className="py-1.5 pr-2 font-medium">{p.period}{i === 0 && <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">latest</span>}</td>
                  <td className="px-2 text-right text-muted-foreground">{money(p.salary)}</td>
                  <td className="px-2 text-right text-muted-foreground">{p.gig ? money(p.gig) : '—'}</td>
                  <td className="px-2 text-right text-muted-foreground">{p.bonus ? money(p.bonus) : '—'}</td>
                  <td className="py-1.5 pl-2 text-right font-semibold">{money(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return (
    <div className="kcard">
      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-receipt text-primary" aria-hidden /> Monthly pay</p>
        <span className="text-[11px] text-muted-foreground">Base salary fixed at {money(base)}/mo</span>
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="py-1.5 pr-2">Month</th>
              <th className="px-2 text-right">Tasks</th>
              <th className="px-2 text-right">Base</th>
              <th className="px-2 text-right">Commission</th>
              <th className="px-2 text-right">Bonus</th>
              <th className="py-1.5 pl-2 text-right">Take-home</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((m, i) => (
              <tr key={m.month} className={`border-b border-border/50 last:border-0 ${i === 0 ? 'bg-emerald-500/[0.06]' : ''}`}>
                <td className="py-1.5 pr-2 font-medium">{m.label}{i === 0 && <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">current</span>}</td>
                <td className="px-2 text-right text-muted-foreground">{m.tasks}</td>
                <td className="px-2 text-right text-muted-foreground">{money(m.base)}</td>
                <td className="px-2 text-right">{money(m.commission)}</td>
                <td className="px-2 text-right text-muted-foreground">{m.bonus ? money(m.bonus) : '—'}</td>
                <td className="py-1.5 pl-2 text-right font-semibold">{money(m.takeHome)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Payouts (methods + request history) ───────────────────────────────────────
function PayoutsTab({ payouts, methods, onRequest, onAddMethod, onSetDefault, onRemove }: { payouts: PayoutRequest[]; methods: PayoutMethod[]; onRequest: () => void; onAddMethod: () => void; onSetDefault: (id: string) => void; onRemove: (id: string) => void }) {
  const methodLabel = (id: string) => methods.find((m) => m.id === id)?.label ?? id;
  return (
    <div className="space-y-3">
      <div className="kcard">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-credit-card text-primary" aria-hidden /> Payout methods</p>
          <button onClick={onAddMethod} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-primary/60 hover:bg-accent"><i className="ph-bold ph-plus" aria-hidden /> Add method</button>
        </div>
        {methods.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No payout method yet — add one to request a payout.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-3">
            {methods.map((m) => {
              const meta = PAYOUT_METHOD_META[m.kind];
              return (
                <li key={m.id} className={`group rounded-xl border p-3 ${m.isDefault ? 'border-primary/50 bg-primary/[0.04]' : 'border-border'}`}>
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><i className={`ph-bold ${meta.icon} text-primary`} aria-hidden /> {meta.label}{m.isDefault && <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">Default</span>}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{m.label}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Fee {m.feePct}% · ~{m.etaDays}d</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    {!m.isDefault && <button onClick={() => onSetDefault(m.id)} className="font-semibold text-primary hover:underline">Set default</button>}
                    <button onClick={() => onRemove(m.id)} className="ml-auto font-semibold text-muted-foreground transition hover:text-rose-500"><i className="ph-bold ph-trash" aria-hidden /> Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="kcard">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-clock-counter-clockwise text-primary" aria-hidden /> Payout history</p>
          <button onClick={onRequest} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"><i className="ph-bold ph-plus" aria-hidden /> New request</button>
        </div>
        {payouts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No payouts yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {payouts.map((p) => {
              const st = PAYOUT_STATUS_META[p.status];
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="display font-bold">{money(p.amount)}</span>
                  <span className="text-xs text-muted-foreground">→ {methodLabel(p.methodId)}</span>
                  <span className={`pill ${st.pill}`}>{st.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.requestedAt}</span>
                  {p.note && <span className="w-full text-[11px] text-muted-foreground">“{p.note}”</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Request payout (SlideOver form) ───────────────────────────────────────────
function RequestPayoutForm({ available, methods, onClose, onSubmit, onAddMethod }: { available: number; methods: PayoutMethod[]; onClose: () => void; onSubmit: (amount: number, methodId: string, note: string) => void; onAddMethod: () => void }) {
  const [amount, setAmount] = useState<string>(String(available));
  const [methodId, setMethodId] = useState<string>(methods.find((m) => m.isDefault)?.id ?? methods[0]?.id ?? '');
  const [note, setNote] = useState('');
  const value = Number(amount) || 0;
  const method = methods.find((m) => m.id === methodId);
  const fee = withdrawalFee(value, method);
  const net = Math.max(0, value - fee);
  const tooLow = value < MIN_PAYOUT;
  const tooHigh = value > available;
  const invalid = tooLow || tooHigh || !methodId;

  return (
    <SlideOver open onClose={onClose} title="Request a payout">
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">Available to withdraw</span>
          <p className="display text-2xl font-bold">{money(available)}</p>
        </div>

        <div>
          <label htmlFor="payout-amount" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount (USD)</label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:border-primary">
            <span className="text-muted-foreground">$</span>
            <input id="payout-amount" type="number" min={MIN_PAYOUT} max={available} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent outline-none" />
            <button type="button" onClick={() => setAmount(String(available))} className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-semibold hover:bg-accent">Max</button>
          </div>
          {tooLow && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Minimum payout is {money(MIN_PAYOUT)}.</p>}
          {tooHigh && <p className="mt-1 text-xs text-rose-500">Exceeds your available balance.</p>}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="payout-method" className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Method</label>
            <button type="button" onClick={onAddMethod} className="text-[11px] font-semibold text-primary hover:underline"><i className="ph-bold ph-plus" aria-hidden /> Add new</button>
          </div>
          {methods.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">No payment method on file — <button type="button" onClick={onAddMethod} className="font-semibold text-primary hover:underline">add one</button> to continue.</p>
          ) : (
            <select id="payout-method" value={methodId} onChange={(e) => setMethodId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary">
              {methods.map((m) => <option key={m.id} value={m.id}>{PAYOUT_METHOD_META[m.kind].label} · {m.label} (fee {m.feePct}%)</option>)}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="payout-note" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Note (optional)</label>
          <textarea id="payout-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything the admin should know…" className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>

        <div className="space-y-1 rounded-xl border border-border p-3 text-sm">
          <Row label="Requested" value={money(value)} />
          <Row label={`Fee (${method?.feePct ?? 0}%)`} value={fee ? `−${money(fee)}` : money(0)} muted />
          <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold"><span>You receive</span><span>{money(net)}</span></div>
          {method && <p className="pt-1 text-[11px] text-muted-foreground">Arrives in ~{method.etaDays} day{method.etaDays === 1 ? '' : 's'} after approval.</p>}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Cancel</button>
          <button onClick={() => onSubmit(value, methodId, note)} disabled={invalid} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Request {money(value)}</button>
        </div>
      </div>
    </SlideOver>
  );
}

// ── Add payment method (SlideOver form) ───────────────────────────────────────
const KIND_ORDER: PayoutMethodKind[] = ['bank', 'paypal', 'wise'];
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function AddMethodForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (m: Omit<PayoutMethod, 'id' | 'isDefault'>, makeDefault: boolean) => void }) {
  const [kind, setKind] = useState<PayoutMethodKind>('bank');
  const [bankName, setBankName] = useState('');
  const [holder, setHolder] = useState('');
  const [account, setAccount] = useState('');
  const [email, setEmail] = useState('');
  const [makeDefault, setMakeDefault] = useState(true);

  // Validate + build the masked label per kind. We persist only the masked label, never raw digits.
  const bankValid = bankName.trim().length > 1 && holder.trim().length > 1 && account.replace(/[\s-]+/g, '').length >= 4;
  const emailValid = isEmail(email);
  const valid = kind === 'bank' ? bankValid : emailValid;
  const label = kind === 'bank' ? `${bankName.trim()} ${maskTail(account)}` : maskEmail(email.trim());

  const submit = () => {
    if (!valid) return;
    const { feePct, etaDays } = METHOD_DEFAULTS[kind];
    onSubmit({ kind, label, feePct, etaDays }, makeDefault);
  };

  return (
    <SlideOver open onClose={onClose} title="Add a payment method">
      <div className="space-y-5">
        {/* Kind selector */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How do you want to get paid?</p>
          <div className="grid grid-cols-3 gap-2">
            {KIND_ORDER.map((k) => {
              const meta = PAYOUT_METHOD_META[k];
              const active = kind === k;
              return (
                <button key={k} type="button" onClick={() => setKind(k)} className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                  <i className={`ph-bold ${meta.icon} text-lg`} aria-hidden /> {meta.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Fee {METHOD_DEFAULTS[kind].feePct}% · arrives in ~{METHOD_DEFAULTS[kind].etaDays} day{METHOD_DEFAULTS[kind].etaDays === 1 ? '' : 's'}.</p>
        </div>

        {/* Kind-specific fields */}
        {kind === 'bank' ? (
          <div className="space-y-3">
            <Field label="Bank name" id="bank-name"><input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Vietcombank" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></Field>
            <Field label="Account holder" id="bank-holder"><input id="bank-holder" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Full name on the account" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></Field>
            <Field label="Account number" id="bank-acct"><input id="bank-acct" value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" placeholder="Only the last 4 digits are stored" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></Field>
          </div>
        ) : (
          <Field label={`${PAYOUT_METHOD_META[kind].label} email`} id="method-email">
            <input id="method-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            {email.length > 0 && !emailValid && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Enter a valid email address.</p>}
          </Field>
        )}

        {/* Preview + default */}
        {valid && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
            <i className={`ph-bold ${PAYOUT_METHOD_META[kind].icon} text-primary`} aria-hidden />
            <span className="font-medium">{label}</span>
            <span className="ml-auto text-xs text-muted-foreground">how it'll show</span>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-4 w-4 rounded border-border" />
          Make this my default payout method
        </label>

        <p className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground"><i className="ph-bold ph-shield-check mr-1 text-emerald-500" aria-hidden />We store only a masked label (e.g. ••{'1234'}) — never your full account number.</p>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Cancel</button>
          <button onClick={submit} disabled={!valid} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Add method</button>
        </div>
      </div>
    </SlideOver>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ── Dispute (SlideOver form) ──────────────────────────────────────────────────
function DisputeForm({ penalty, onClose, onSubmit }: { penalty: StaffPenalty; onClose: () => void; onSubmit: (id: string, note: string) => void }) {
  const [note, setNote] = useState('');
  const meta = PENALTY_TYPE_META[penalty.type];
  return (
    <SlideOver open onClose={onClose} title="Dispute a penalty">
      <div className="space-y-4">
        <div className="rounded-xl border border-border p-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${meta.icon} text-amber-500`} aria-hidden /> {meta.label} {penalty.taskCode && <span className="font-mono text-xs text-muted-foreground">{penalty.taskCode}</span>}<span className="ml-auto font-bold text-rose-500">−{money(penalty.amount)}</span></p>
          <p className="mt-1 text-sm text-muted-foreground">{penalty.reason}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{penalty.detail}</p>
        </div>
        <div>
          <label htmlFor="dispute-note" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Why is this wrong?</label>
          <textarea id="dispute-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Explain what happened — your manager reviews disputes." className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Cancel</button>
          <button onClick={() => onSubmit(penalty.id, note.trim())} disabled={!note.trim()} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Send dispute</button>
        </div>
      </div>
    </SlideOver>
  );
}

// ── Small shared bits ─────────────────────────────────────────────────────────
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className={muted ? 'text-muted-foreground' : 'font-medium'}>{value}</span></div>;
}
function Empty({ icon, text }: { icon: string; text: string }) {
  return <div className="kcard text-center text-sm text-muted-foreground"><i className={`ph-bold ${icon} mb-1 block text-xl`} aria-hidden />{text}</div>;
}

// Next payroll date (payroll runs on the 5th), as a label + days away.
function nextPayday(today: string): { label: string; days: number } {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date(`${today}T00:00:00Z`);
  let pay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5));
  if (now.getUTCDate() >= 5) pay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 5));
  const days = Math.round((pay.getTime() - now.getTime()) / 86_400_000);
  return { label: `${MONTHS[pay.getUTCMonth()]} ${pay.getUTCDate()}`, days };
}

// SVG stacked bars — commission (+ bonus) per month. Ported from the Performance earnings card.
function EarningsBars({ history }: { history: MonthEarning[] }) {
  const W = 640, H = 200, padL = 46, padR = 12, padT = 22, padB = 36;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const totals = history.map((m) => m.commission + m.bonus);
  const max = Math.max(1, ...totals);
  const niceMax = Math.ceil(max / 50) * 50 || 50;
  const avg = totals.reduce((a, b) => a + b, 0) / (totals.length || 1);
  const n = history.length;
  const slot = plotW / n;
  const barW = Math.min(42, slot * 0.46);
  const yOf = (v: number) => padT + plotH - (v / niceMax) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label="Variable pay by month">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="currentColor" className="text-border" strokeWidth={1} strokeOpacity={0.6} />
          <text x={padL - 6} y={yOf(t) + 3} textAnchor="end" fill="currentColor" className="text-muted-foreground" style={{ fontSize: 9 }}>{money(t)}</text>
        </g>
      ))}
      {avg > 0 && (
        <>
          <line x1={padL} y1={yOf(avg)} x2={W - padR} y2={yOf(avg)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.8} />
          <text x={W - padR} y={yOf(avg) - 4} textAnchor="end" fill="#f59e0b" style={{ fontSize: 9, fontWeight: 600 }}>avg {money(Math.round(avg))}</text>
        </>
      )}
      {history.map((m, i) => {
        const cx = padL + slot * i + slot / 2;
        const total = m.commission + m.bonus;
        const baseY = yOf(0), yComm = yOf(m.commission), yTotal = yOf(total);
        return (
          <g key={m.month}>
            <rect x={cx - barW / 2} y={yComm} width={barW} height={Math.max(0, baseY - yComm)} rx={2} fill="#8b5cf6">
              <title>{`${m.label}: commission ${money(m.commission)}${m.bonus ? ` · bonus ${money(m.bonus)}` : ''} · ${m.tasks} tasks`}</title>
            </rect>
            {m.bonus > 0 && <rect x={cx - barW / 2} y={yTotal} width={barW} height={Math.max(0, yComm - yTotal)} rx={2} fill="#f59e0b" />}
            <text x={cx} y={yTotal - 6} textAnchor="middle" fill="currentColor" className="text-foreground" style={{ fontSize: 10, fontWeight: 700 }}>{money(total)}</text>
            <text x={cx} y={H - padB + 16} textAnchor="middle" fill="currentColor" className="text-foreground" style={{ fontSize: 11, fontWeight: 600 }}>{m.label}</text>
            <text x={cx} y={H - padB + 29} textAnchor="middle" fill="currentColor" className="text-muted-foreground" style={{ fontSize: 9 }}>{m.tasks} task{m.tasks === 1 ? '' : 's'}</text>
          </g>
        );
      })}
    </svg>
  );
}
