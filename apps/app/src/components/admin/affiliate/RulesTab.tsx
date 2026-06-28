'use client';
import { money } from '@/data/adminMock';
import {
  DEFAULT_RULES, defaultTierRows,
  type ProgramRules, type EditableTier, type AdminAffiliate, type PartnerStatus,
} from '@/data/adminAffiliate';
import { StatusBadge } from './shared';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-primary' : 'bg-muted'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

const Segmented = <T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}) => (
  <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
    {options.map((o) => (
      <button key={o.v} type="button" onClick={() => onChange(o.v)}
        className={`rounded-md px-2.5 py-1 transition ${value === o.v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{o.label}</button>
    ))}
  </div>
);

const numInput = 'w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-primary';
const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0">
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </div>
);

export function RulesTab({
  rules, setRules, tierRows, setTierRows, applications, onToggle,
}: {
  rules: ProgramRules;
  setRules: (next: ProgramRules) => void;
  tierRows: EditableTier[];
  setTierRows: (next: EditableTier[]) => void;
  applications: AdminAffiliate[];
  onToggle: (id: string, next: PartnerStatus) => void;
}) {
  const patch = (p: Partial<ProgramRules>) => setRules({ ...rules, ...p });
  const editTier = (id: string, p: Partial<EditableTier>) =>
    setTierRows(tierRows.map((t) => (t.id === id ? { ...t, ...p } : t)));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Tier editor */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-stack text-primary" /> Commission tiers</p>
          <button type="button" onClick={() => setTierRows(defaultTierRows())} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Reset</button>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">Rate applies to every referred order once lifetime volume crosses the threshold.</p>
        <div className="mt-3 space-y-2">
          {tierRows.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2">
              <span className="flex w-24 items-center gap-1.5 text-sm font-bold capitalize"><i className="ph-fill ph-crown-simple text-amber-500 text-xs" /> {t.label}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                ≥ $<input type="number" min={0} step={500} value={t.minVolume} onChange={(e) => editTier(t.id, { minVolume: Number(e.target.value) })} className={numInput} />
              </label>
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                rate <input type="number" min={0} max={100} step={1} value={Math.round(t.rate * 100)} onChange={(e) => editTier(t.id, { rate: Number(e.target.value) / 100 })} className="w-16 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-primary" /> %
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Program rules */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-sliders text-primary" /> Program rules</p>
          <button type="button" onClick={() => setRules(DEFAULT_RULES)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Reset</button>
        </div>
        <div className="mt-2">
          <Row label="Approval mode" hint="Instant = link works on signup">
            <Segmented value={rules.approvalMode} onChange={(v) => patch({ approvalMode: v })}
              options={[{ v: 'instant', label: 'Instant' }, { v: 'manual', label: 'Manual' }]} />
          </Row>
          <Row label="Attribution" hint="How long a referred customer stays yours">
            <Segmented value={rules.attribution} onChange={(v) => patch({ attribution: v })}
              options={[{ v: 'lifetime', label: 'Lifetime' }, { v: 'window', label: 'Windowed' }]} />
          </Row>
          <Row label="Cookie window" hint="Days a click stays attributable">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="number" min={1} value={rules.cookieWindowDays} onChange={(e) => patch({ cookieWindowDays: Number(e.target.value) })} className={numInput} /> days</span>
          </Row>
          <Row label="Commission hold" hint="Days before commission clears for payout">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="number" min={0} value={rules.holdDays} onChange={(e) => patch({ holdDays: Number(e.target.value) })} className={numInput} /> days</span>
          </Row>
          <Row label="Minimum payout" hint="Balance needed to withdraw">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">$<input type="number" min={0} step={10} value={rules.minPayout} onChange={(e) => patch({ minPayout: Number(e.target.value) })} className={numInput} /></span>
          </Row>
          <Row label="Recurring commission" hint="Repeat orders keep paying">
            <Toggle on={rules.recurring} onChange={(v) => patch({ recurring: v })} />
          </Row>
          <Row label="Block self-referrals" hint="Stop partners referring themselves">
            <Toggle on={rules.selfReferralBlock} onChange={(v) => patch({ selfReferralBlock: v })} />
          </Row>
        </div>
        <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">Changes are saved in-session (mock). The live program reads these once the backend lands.</p>
      </section>

      {/* Pending applications */}
      <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-user-list text-primary" /> Pending applications {applications.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600">{applications.length}</span>}</p>
        {applications.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No applications waiting. {rules.approvalMode === 'instant' && 'Approval is instant — new partners go live automatically.'}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {applications.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white">{a.avatarInitials}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name} <span className="font-normal text-muted-foreground">{a.handle}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{a.platform} · {a.niche} · applied {a.joinedAt}</p>
                </div>
                <StatusBadge status={a.status} />
                <div className="ml-auto flex gap-1.5">
                  <button type="button" onClick={() => onToggle(a.id, 'active')} className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20">Approve</button>
                  <button type="button" onClick={() => onToggle(a.id, 'suspended')} className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
