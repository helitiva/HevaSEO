'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminSettings, SlaTarget } from '@/data/adminMock';

type Props = { settings: AdminSettings };

const SECTIONS = [
  { id: 'general', label: 'General', icon: 'ph-buildings', desc: 'Business identity & locale' },
  { id: 'sla', label: 'SLA targets', icon: 'ph-timer', desc: 'Response & resolution goals' },
  { id: 'routing', label: 'Routing & scoring', icon: 'ph-shuffle', desc: 'How work is assigned' },
  { id: 'email', label: 'Email templates', icon: 'ph-envelope-simple', desc: 'Customer-facing messages' },
  { id: 'integrations', label: 'Integrations', icon: 'ph-plugs-connected', desc: 'Stripe, email, security' },
  { id: 'admins', label: 'Admins', icon: 'ph-users-three', desc: 'Who can sign in' },
] as const;

const TIMEZONES = ['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Singapore', 'Asia/Ho_Chi_Minh'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'VND'];
const LOCALES = ['en-US', 'en-GB', 'vi-VN'];

const SAMPLE_STAFF = [
  { name: 'Mai T.', quality: 96, onTime: 85, throughput: 70 },
  { name: 'Leo K.', quality: 82, onTime: 94, throughput: 78 },
  { name: 'Sara P.', quality: 88, onTime: 80, throughput: 92 },
];
const clone = (s: AdminSettings): AdminSettings => JSON.parse(JSON.stringify(s));

export function SettingsClient({ settings }: Props) {
  const [s, setS] = useState<AdminSettings>(settings);
  const [saved, setSaved] = useState<AdminSettings>(settings);
  const [tab, setTab] = useState<string>('general');
  const [toast, setToast] = useState('');

  const dirty = useMemo(() => JSON.stringify(s) !== JSON.stringify(saved), [s, saved]);

  // tab is URL state — shareable / survives refresh
  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (t && SECTIONS.some((x) => x.id === t)) setTab(t); }, []);
  useEffect(() => { const url = new URL(window.location.href); url.searchParams.set('tab', tab); window.history.replaceState(null, '', `${url.pathname}${url.search}`); }, [tab]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000); };
  const save = () => { setSaved(clone(s)); flash('Settings saved · change logged to the audit log'); };
  const discard = () => setS(clone(saved));

  const setBiz = (k: keyof AdminSettings['business'], v: string) => setS((p) => ({ ...p, business: { ...p.business, [k]: v } }));

  return (
    <div className="relative">
      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        {/* section nav */}
        <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {SECTIONS.map((sec) => (
            <button key={sec.id} onClick={() => setTab(sec.id)} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left transition lg:w-full ${tab === sec.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <i className={`ph-bold ${sec.icon} text-lg`} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{sec.label}</span>
                <span className="hidden text-[11px] opacity-70 lg:block">{sec.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* content */}
        <div className="min-w-0 pb-20">
          {tab === 'general' && (
            <Card title="General" hint="Business identity shown to customers and used across emails & invoices.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name"><input className={inp} value={s.business.name} onChange={(e) => setBiz('name', e.target.value)} /></Field>
                <Field label="Support email" hint={!/.+@.+\..+/.test(s.business.supportEmail) ? 'Enter a valid email' : undefined}><input className={inp} value={s.business.supportEmail} onChange={(e) => setBiz('supportEmail', e.target.value)} /></Field>
                <Field label="Address" className="sm:col-span-2"><input className={inp} value={s.business.address} onChange={(e) => setBiz('address', e.target.value)} /></Field>
                <Field label="Timezone"><select className={inp} value={s.business.timezone} onChange={(e) => setBiz('timezone', e.target.value)}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Currency display"><select className={inp} value={s.business.currency} onChange={(e) => setBiz('currency', e.target.value)}>{CURRENCIES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Locale"><select className={inp} value={s.business.locale} onChange={(e) => setBiz('locale', e.target.value)}>{LOCALES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Brand color">
                  <div className="flex items-center gap-2">
                    <input type="color" value={s.business.brandColor} onChange={(e) => setBiz('brandColor', e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent" />
                    <input className={inp} value={s.business.brandColor} onChange={(e) => setBiz('brandColor', e.target.value)} />
                  </div>
                </Field>
              </div>
            </Card>
          )}

          {tab === 'sla' && (
            <Card title="SLA targets" hint="Goal hours read by the Order SLA timers and the Tickets queue. First response = time to first touch; resolution = time to close.">
              <SlaTable title="Orders — by priority" rows={[['high', 'High'], ['med', 'Medium'], ['low', 'Low']]} get={(k) => s.sla.orders[k as 'high' | 'med' | 'low']}
                set={(k, m, v) => setS((p) => ({ ...p, sla: { ...p.sla, orders: { ...p.sla.orders, [k]: { ...p.sla.orders[k as 'high' | 'med' | 'low'], [m]: v } } } }))} />
              <div className="h-5" />
              <SlaTable title="Tickets — by tier" rows={[['urgent', 'Urgent'], ['standard', 'Standard']]} get={(k) => s.sla.tickets[k as 'urgent' | 'standard']}
                set={(k, m, v) => setS((p) => ({ ...p, sla: { ...p.sla, tickets: { ...p.sla.tickets, [k]: { ...p.sla.tickets[k as 'urgent' | 'standard'], [m]: v } } } }))} />
            </Card>
          )}

          {tab === 'routing' && (
            <Card title="Routing & scoring" hint="The tunables the Assignment engine reads. Adjust after a trial period — changes take effect for new orders only.">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Routing</p>
              <Slider label="Skill match weight" value={s.routing.skillWeight} suffix="%" onChange={(v) => setS((p) => ({ ...p, routing: { ...p.routing, skillWeight: v } }))} />
              <Slider label="Capacity penalty" hint="Higher = avoid loading busy staff" max={300} value={s.routing.capacityPenalty} onChange={(v) => setS((p) => ({ ...p, routing: { ...p.routing, capacityPenalty: v } }))} />
              <label className="mt-2 flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="font-medium">Round-robin tie-break <span className="text-muted-foreground">— even out equal candidates</span></span>
                <Toggle on={s.routing.roundRobin} onToggle={() => setS((p) => ({ ...p, routing: { ...p.routing, roundRobin: !p.routing.roundRobin } }))} />
              </label>

              <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Composite score weights <span className={`ml-1 ${s.scoring.quality + s.scoring.onTime + s.scoring.throughput === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>(sum {s.scoring.quality + s.scoring.onTime + s.scoring.throughput}%)</span></p>
              <Slider label="Quality" value={s.scoring.quality} suffix="%" onChange={(v) => setS((p) => ({ ...p, scoring: { ...p.scoring, quality: v } }))} />
              <Slider label="On-time" value={s.scoring.onTime} suffix="%" onChange={(v) => setS((p) => ({ ...p, scoring: { ...p.scoring, onTime: v } }))} />
              <Slider label="Throughput" value={s.scoring.throughput} suffix="%" onChange={(v) => setS((p) => ({ ...p, scoring: { ...p.scoring, throughput: v } }))} />

              <div className="mt-5 rounded-xl border border-border bg-muted/30 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><i className="ph-bold ph-eye text-primary" />Live preview — how staff rank for a new order</p>
                <ScorePreview weights={s.scoring} />
              </div>
            </Card>
          )}

          {tab === 'email' && <EmailSection s={s} setS={setS} />}

          {tab === 'integrations' && (
            <Card title="Integrations" hint="Connection status & non-secret config. API keys & secrets live in environment variables — never stored here.">
              <div className="space-y-2.5">
                {s.integrations.map((it) => (
                  <div key={it.key} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-lg"><i className={`ph-bold ${it.icon}`} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold">{it.name}
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${it.status === 'connected' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}><i className={`ph-fill ${it.status === 'connected' ? 'ph-check-circle' : 'ph-circle'}`} />{it.status}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{it.detail}</p>
                    </div>
                    {it.status === 'connected'
                      ? <button onClick={() => flash(`Pinged ${it.name} — connection OK`)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent">Test</button>
                      : <button onClick={() => setS((p) => ({ ...p, integrations: p.integrations.map((x) => x.key === it.key ? { ...x, status: 'connected' } : x) }))} className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">Connect</button>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'admins' && <AdminsSection s={s} setS={setS} />}
        </div>
      </div>

      {/* unsaved-changes bar */}
      {dirty && (
        <div className="modal-in fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:left-[var(--sidebar-w,0)]">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-medium"><i className="ph-fill ph-warning-circle text-amber-500" />Unsaved changes <span className="hidden text-xs text-muted-foreground sm:inline">· changes are logged to the audit log</span></span>
            <div className="ml-auto flex gap-2">
              <button onClick={discard} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Discard</button>
              <button onClick={save} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">Save changes</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-in fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">{toast}</div>}
    </div>
  );
}

const inp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {hint && <p className="mb-4 mt-0.5 max-w-prose text-sm text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] font-medium text-amber-600">{hint}</span>}
    </label>
  );
}
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <button role="switch" aria-checked={on} onClick={onToggle} className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[1.125rem]' : 'left-0.5'}`} /></button>;
}
function Slider({ label, hint, value, onChange, max = 100, suffix = '' }: { label: string; hint?: string; value: number; onChange: (v: number) => void; max?: number; suffix?: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium">{label}{hint && <span className="ml-1 text-xs text-muted-foreground">{hint}</span>}</span><span className="font-semibold tabular-nums">{value}{suffix}</span></div>
      <input type="range" min={0} max={max} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
    </div>
  );
}
function SlaTable({ title, rows, get, set }: { title: string; rows: [string, string][]; get: (k: string) => SlaTarget; set: (k: string, m: keyof SlaTarget, v: number) => void }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1fr_8rem_8rem] bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground"><span>Level</span><span>First response (h)</span><span>Resolution (h)</span></div>
        {rows.map(([k, label]) => { const t = get(k); return (
          <div key={k} className="grid grid-cols-[1fr_8rem_8rem] items-center border-t border-border px-3 py-2 text-sm">
            <span className="font-medium">{label}</span>
            <input type="number" min={0} value={t.firstResponseH} onChange={(e) => set(k, 'firstResponseH', +e.target.value)} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary" />
            <input type="number" min={0} value={t.resolutionH} onChange={(e) => set(k, 'resolutionH', +e.target.value)} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary" />
          </div>
        ); })}
      </div>
    </div>
  );
}
function ScorePreview({ weights }: { weights: { quality: number; onTime: number; throughput: number } }) {
  const sum = weights.quality + weights.onTime + weights.throughput || 1;
  const ranked = SAMPLE_STAFF.map((st) => ({ name: st.name, score: Math.round((st.quality * weights.quality + st.onTime * weights.onTime + st.throughput * weights.throughput) / sum) })).sort((a, b) => b.score - a.score);
  const top = ranked[0].score;
  return (
    <div className="space-y-1.5">
      {ranked.map((r, i) => (
        <div key={r.name} className="flex items-center gap-2 text-xs">
          <span className={`w-14 shrink-0 font-medium ${i === 0 ? 'text-primary' : ''}`}>{i === 0 && '★ '}{r.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/50'}`} style={{ width: `${(r.score / top) * 100}%` }} /></div>
          <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{r.score}</span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-muted-foreground">Winner gets the next matching order. Drag the weights to see ranking shift.</p>
    </div>
  );
}

const EMAIL_SAMPLE: Record<string, string> = { customer: 'Acme Co', order_code: 'ORD-2042', service: 'Backlink Builder', business: 'HevaSEO', amount: '$140.00', ticket_subject: 'Cannot access dashboard', reply_body: 'We’ve reset your access — please try signing in again.', agent: 'Sofia' };
function renderTpl(str: string, business: string): string { return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === 'business' ? business : EMAIL_SAMPLE[k]) ?? `{{${k}}}`); }

function EmailSection({ s, setS }: { s: AdminSettings; setS: React.Dispatch<React.SetStateAction<AdminSettings>> }) {
  const [sel, setSel] = useState(s.email[0].id);
  const t = s.email.find((x) => x.id === sel) ?? s.email[0];
  const setT = (field: 'subject' | 'body', v: string) => setS((p) => ({ ...p, email: p.email.map((x) => x.id === t.id ? { ...x, [field]: v } : x) }));
  const unknownVars = [...t.body.matchAll(/\{\{(\w+)\}\}/g), ...t.subject.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((v) => v !== 'business' && !EMAIL_SAMPLE[v]);
  return (
    <Card title="Email templates" hint="Edit the customer-facing copy. Insert variables with the chips — the preview renders them with sample data.">
      <div className="grid gap-4 lg:grid-cols-[12rem_1fr]">
        <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {s.email.map((e) => (
            <button key={e.id} onClick={() => setSel(e.id)} className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition lg:w-full ${sel === e.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>{e.name}</button>
          ))}
        </div>
        <div className="min-w-0 space-y-3">
          <Field label="Subject"><input className={inp} value={t.subject} onChange={(e) => setT('subject', e.target.value)} /></Field>
          <Field label="Body"><textarea rows={7} className={`${inp} resize-y font-mono text-xs leading-relaxed`} value={t.body} onChange={(e) => setT('body', e.target.value)} /></Field>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Variables:</span>
            {t.vars.map((v) => <button key={v} onClick={() => setT('body', `${t.body}{{${v}}}`)} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-primary/10 hover:text-primary">{`{{${v}}}`}</button>)}
          </div>
          {unknownVars.length > 0 && <p className="text-[11px] font-medium text-amber-600"><i className="ph-bold ph-warning mr-1" />Unknown variable(s): {[...new Set(unknownVars)].map((v) => `{{${v}}}`).join(', ')}</p>}
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><i className="ph-bold ph-eye" />Preview</p>
            <p className="text-sm font-semibold">{renderTpl(t.subject, s.business.name)}</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{renderTpl(t.body, s.business.name)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

const ini = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
function AdminsSection({ s, setS }: { s: AdminSettings; setS: React.Dispatch<React.SetStateAction<AdminSettings>> }) {
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const validEmail = /.+@.+\..+/.test(email);
  const invite = () => {
    if (!validEmail) return;
    const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    setS((p) => ({ ...p, admins: [...p.admins, { id: `ad${p.admins.length + 1}`, name, email, role: 'Admin', lastActive: 'pending invite', status: 'invited', twoFA: false }] }));
    setEmail(''); setInviting(false);
  };
  return (
    <Card title="Admins" hint="People who can sign in to this dashboard. Master admin can invite or deactivate others.">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{s.admins.filter((a) => a.status === 'active').length} active · {s.admins.length} total</span>
        <button onClick={() => setInviting((v) => !v)} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"><i className="ph-bold ph-user-plus mr-1" />Invite admin</button>
      </div>
      {inviting && (
        <div className="modal-in mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
          <input autoFocus className={`${inp} flex-1`} placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invite()} />
          <button onClick={invite} disabled={!validEmail} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">Send invite</button>
          <button onClick={() => { setInviting(false); setEmail(''); }} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-accent">Cancel</button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border">
        {s.admins.map((a, i) => (
          <div key={a.id} className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-border' : ''} ${a.status === 'disabled' ? 'opacity-50' : ''}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{ini(a.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold">{a.name}
                {a.role === 'Master admin' && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{a.role}</span>}
                {a.twoFA && <i className="ph-fill ph-shield-check text-xs text-emerald-600" title="2FA enabled" />}
              </p>
              <p className="truncate text-xs text-muted-foreground">{a.email} · {a.lastActive}</p>
            </div>
            {a.status === 'invited' && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">invited</span>}
            {a.role !== 'Master admin' && a.status !== 'disabled' && <button onClick={() => setS((p) => ({ ...p, admins: p.admins.map((x) => x.id === a.id ? { ...x, status: 'disabled' } : x) }))} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive">Deactivate</button>}
            {a.status === 'disabled' && <button onClick={() => setS((p) => ({ ...p, admins: p.admins.map((x) => x.id === a.id ? { ...x, status: 'active' } : x) }))} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:text-foreground">Reactivate</button>}
          </div>
        ))}
      </div>
    </Card>
  );
}
