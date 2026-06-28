'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTheme } from 'next-themes';
import { useToast } from './Toast';
import { useCredit } from './CreditStore';
import { Modal } from './Modal';
import { TeamSettings } from './TeamSettings';

type TabKey = 'profile' | 'security' | 'notif' | 'billing' | 'team' | 'api' | 'appearance';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'profile', label: 'Profile', icon: 'ph-user' },
  { key: 'security', label: 'Account & Security', icon: 'ph-shield-check' },
  { key: 'notif', label: 'Notifications', icon: 'ph-bell' },
  { key: 'billing', label: 'Billing & Credit', icon: 'ph-wallet' },
  { key: 'team', label: 'Team', icon: 'ph-users-three' },
  { key: 'api', label: 'API & Webhook', icon: 'ph-plugs-connected' },
  { key: 'appearance', label: 'Appearance & Language', icon: 'ph-palette' },
];

const PLANS = [
  { key: 'Starter', desc: 'Pay as you go · standard support' },
  { key: 'Pro', desc: '5% off every order · faster support' },
  { key: 'VIP', desc: '15% off every order · priority support' },
  { key: 'Agency', desc: 'Sub-accounts · per-project permissions' },
];

const INDUSTRIES = ['E-commerce', 'Retail / Supermarket', 'Healthcare / Dental / Clinics', 'Aesthetics / Spa / Beauty', 'Real estate', 'Education / Training', 'Travel / Hospitality', 'Restaurants / F&B', 'Finance / Insurance', 'Technology / Software / SaaS', 'Construction / Interiors', 'Automotive', 'Fashion / Cosmetics', 'Legal / Business consulting', 'Manufacturing / Industrial', 'Logistics / Transportation', 'Agriculture / Food', 'Events / Entertainment'];

/** Controlled form values that persist to localStorage on save. */
function usePersistedForm<T extends Record<string, string>>(key: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setData((d) => ({ ...d, ...(JSON.parse(s) as Partial<T>) })); } catch { /* ignore malformed */ }
  }, [key]);
  const field = (k: keyof T) => ({
    value: data[k],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setData((d) => ({ ...d, [k]: e.target.value })),
  });
  const save = () => localStorage.setItem(key, JSON.stringify(data));
  const reset = () => { setData(initial); localStorage.removeItem(key); };
  return { field, save, reset };
}

/** Toggle that remembers its state across reloads when given an `id`. */
function Switch({ defaultOn = false, id }: { defaultOn?: boolean; id?: string }) {
  const [on, setOn] = useState(defaultOn);
  useEffect(() => {
    if (!id) return;
    const saved = localStorage.getItem(`heva.set.${id}`);
    if (saved != null) setOn(saved === '1');
  }, [id]);
  const toggle = () => setOn((v) => { const n = !v; if (id) localStorage.setItem(`heva.set.${id}`, n ? '1' : '0'); return n; });
  return (
    <div
      className={`switch${on ? ' on' : ''}`}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } }}
    />
  );
}

export function SettingsView() {
  const [tab, setTab] = useState<TabKey>('profile');
  const toast = useToast();
  const { balance } = useCredit();
  const [apiKey, setApiKey] = useState('sk_live_••••••••••••••••8f2a');
  const [mobileSession, setMobileSession] = useState(true);
  const [plan, setPlan] = useState('VIP');
  const [planOpen, setPlanOpen] = useState(false);
  const planDesc = PLANS.find((p) => p.key === plan)?.desc ?? '';
  const profile = usePersistedForm('heva.profile', { name: 'Huy Nguyen', email: 'huy@hevashop.com', phone: '+1 (415) 555-0142', company: 'HevaShop JSC', industry: 'E-commerce', website: 'hevashop.com' });
  const billing = usePersistedForm('heva.billing', { company: 'HevaShop Inc.', taxId: '0312345678', address: '123 Market St, San Francisco, CA' });

  const saved = (msg: string) => (e: FormEvent) => { e.preventDefault(); toast(msg); };
  const updatePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = String(fd.get('new') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    if (next.length < 8) { toast('New password must be at least 8 characters', 'error'); return; }
    if (next !== confirm) { toast('Passwords do not match', 'error'); return; }
    toast('Password updated');
    e.currentTarget.reset();
  };
  const copyKey = async () => {
    try { await navigator.clipboard.writeText(apiKey); toast('API key copied'); }
    catch { toast('Copy failed — select and copy manually', 'error'); }
  };
  const regenerateKey = () => {
    const rand = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 6)).join('');
    setApiKey(`sk_live_${'•'.repeat(16)}${rand.slice(-4)}`);
    toast('API key regenerated — update your integrations');
  };

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[220px_1fr]">
      {/* tab nav */}
      <aside className="lg:sticky lg:top-[84px] h-fit rounded-2xl border border-border bg-card p-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`set-tab${tab === t.key ? ' active' : ''}`}>
            <i className={`ph-bold ${t.icon}`} aria-hidden /> {t.label}
          </button>
        ))}
      </aside>

      <div>
        {tab === 'profile' && (
          <form onSubmit={(e) => { e.preventDefault(); profile.save(); toast('Profile saved'); }} className="rounded-2xl border border-border bg-card p-5 lg:p-6">
            <h2 className="display text-lg font-semibold tracking-tight">Profile</h2>
            <p className="text-xs text-muted-foreground">Information shown to advisors and on invoices.</p>
            <div className="mt-5 flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white">HV</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => toast('Photo upload coming soon')} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent">Change photo</button>
                <button type="button" onClick={() => toast('Photo removed')} className="rounded-lg px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10">Remove</button>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><label className="lbl">Full name</label><input className="field" {...profile.field('name')} /></div>
              <div><label className="lbl">Email</label><input className="field" {...profile.field('email')} /></div>
              <div><label className="lbl">Phone number</label><input className="field" {...profile.field('phone')} /></div>
              <div><label className="lbl">Company</label><input className="field" {...profile.field('company')} /></div>
              <div>
                <label className="lbl">Industry</label>
                <select className="field" {...profile.field('industry')}>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select>
              </div>
              <div><label className="lbl">Default website</label><input className="field" {...profile.field('website')} /></div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { profile.reset(); toast('Changes discarded', 'info'); }} className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Cancel</button>
              <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Save changes</button>
            </div>
          </form>
        )}

        {tab === 'security' && (
          <section className="space-y-4">
            <form onSubmit={updatePassword} className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-lg font-semibold tracking-tight">Change password</h2>
              <div className="mt-4 grid gap-4 sm:max-w-md">
                <div><label className="lbl">Current password</label><input name="current" type="password" required className="field" placeholder="Enter your current password" autoComplete="current-password" /></div>
                <div><label className="lbl">New password</label><input name="new" type="password" required className="field" placeholder="At least 8 characters" autoComplete="new-password" /></div>
                <div><label className="lbl">Confirm new password</label><input name="confirm" type="password" required className="field" autoComplete="new-password" /></div>
              </div>
              <div className="mt-4"><button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Update password</button></div>
            </form>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="display text-base font-semibold tracking-tight">Two-factor authentication (2FA)</h2><p className="text-xs text-muted-foreground">Add security with an OTP code at login.</p></div>
                <Switch defaultOn id="security.2fa" />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-base font-semibold tracking-tight">Login sessions</h2>
              <div className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center gap-3"><i className="ph-bold ph-desktop text-muted-foreground" aria-hidden /><div className="flex-1"><p className="font-medium">Chrome · macOS</p><p className="text-[11px] text-muted-foreground">San Francisco · This device</p></div><span className="pill pill-good">Current</span></div>
                {mobileSession
                  ? <div className="flex items-center gap-3"><i className="ph-bold ph-device-mobile text-muted-foreground" aria-hidden /><div className="flex-1"><p className="font-medium">Safari · iPhone</p><p className="text-[11px] text-muted-foreground">San Francisco · 2 days ago</p></div><button onClick={() => { setMobileSession(false); toast('Signed out of Safari · iPhone'); }} className="text-xs font-semibold text-destructive hover:underline">Sign out</button></div>
                  : <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">No other active sessions.</p>}
              </div>
            </div>
          </section>
        )}

        {tab === 'notif' && (
          <section className="rounded-2xl border border-border bg-card p-5 lg:p-6">
            <h2 className="display text-lg font-semibold tracking-tight">Notifications</h2>
            <p className="text-xs text-muted-foreground">Choose the channels and event types you want to receive.</p>
            <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Channels</p>
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">Email</p><p className="text-[11px] text-muted-foreground">huy@hevashop.com</p></div><Switch defaultOn id="notif.email" /></div>
              <div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">In-app</p><p className="text-[11px] text-muted-foreground">Bell & notification center</p></div><Switch defaultOn id="notif.inapp" /></div>
              <div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">Header ticker</p><p className="text-[11px] text-muted-foreground">Scrolling notification bar</p></div><Switch defaultOn id="notif.ticker" /></div>
            </div>
            <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Event types</p>
            <div className="divide-y divide-border">
              {[['Order status changes', true], ['Links got indexed', true], ['Weekly report', true], ['Low credit alerts', true], ['Promotional emails', false]].map(([label, on]) => (
                <div key={label as string} className="flex items-center justify-between py-3"><p className="text-sm font-medium">{label}</p><Switch defaultOn={on as boolean} id={`notif.evt.${(label as string).toLowerCase().replace(/[^a-z]+/g, '-')}`} /></div>
              ))}
            </div>
          </section>
        )}

        {tab === 'billing' && (
          <section className="space-y-4">
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400/20 text-amber-500"><i className="ph-fill ph-crown text-xl" aria-hidden /></span>
                  <div><p className="display text-lg font-semibold">{plan} plan</p><p className="text-xs text-muted-foreground">{planDesc}</p></div>
                </div>
                <button onClick={() => setPlanOpen(true)} className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Manage plan</button>
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-primary/20 pt-4">
                <div><p className="text-xs text-muted-foreground">Credit balance</p><p className="display text-2xl font-semibold tracking-tight">${balance.toLocaleString('en-US')}</p></div>
                <a href="/credit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]"><i className="ph-bold ph-plus" aria-hidden /> Top up credits</a>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="display text-base font-semibold tracking-tight">Auto top-up</h2><p className="text-xs text-muted-foreground">Automatically top up when your balance runs low so orders aren&apos;t interrupted.</p></div>
                <Switch id="billing.autotopup" />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:max-w-md">
                <div><label className="lbl">When balance falls below</label><input className="field" defaultValue="$40" /></div>
                <div><label className="lbl">Top up</label><input className="field" defaultValue="$199" /></div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <div className="flex items-center justify-between"><h2 className="display text-base font-semibold tracking-tight">Payment methods</h2><a href="/credit" className="text-xs font-semibold text-primary hover:underline">+ Add</a></div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                <i className="ph-bold ph-credit-card text-xl text-primary" aria-hidden />
                <div className="flex-1 text-sm"><p className="font-medium">Visa •••• 4242</p><p className="text-[11px] text-muted-foreground">Expires 08/27</p></div>
                <span className="pill pill-good">Default</span>
              </div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); billing.save(); toast('Billing details saved'); }} className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-base font-semibold tracking-tight">Billing information (VAT)</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div><label className="lbl">Company name</label><input className="field" {...billing.field('company')} /></div>
                <div><label className="lbl">Tax ID</label><input className="field" {...billing.field('taxId')} /></div>
                <div className="sm:col-span-2"><label className="lbl">Address</label><input className="field" {...billing.field('address')} /></div>
              </div>
              <div className="mt-4 flex justify-end"><button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Save details</button></div>
            </form>
          </section>
        )}

        {tab === 'team' && <TeamSettings />}

        {tab === 'api' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-lg font-semibold tracking-tight">API Key</h2>
              <p className="text-xs text-muted-foreground">Use this to integrate HevaSEO into your systems.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input className="field font-mono" style={{ maxWidth: '24rem' }} value={apiKey} readOnly />
                <button onClick={copyKey} className="rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-semibold transition hover:bg-accent"><i className="ph-bold ph-copy" aria-hidden /> Copy</button>
                <button onClick={regenerateKey} className="rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10"><i className="ph-bold ph-arrows-clockwise" aria-hidden /> Regenerate</button>
              </div>
            </div>
            <form onSubmit={saved('Webhook saved')} className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-base font-semibold tracking-tight">Webhook</h2>
              <p className="text-xs text-muted-foreground">Receive real-time events sent to your URL.</p>
              <div className="mt-4"><label className="lbl">Endpoint URL</label><input name="endpoint" type="url" required className="field" placeholder="https://yourapp.com/webhooks/hevaseo" /></div>
              <p className="mt-4 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Outbound events</p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-[hsl(var(--primary))]" /> order.created</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-[hsl(var(--primary))]" /> order.completed</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-[hsl(var(--primary))]" /> index.done</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-[hsl(var(--primary))]" /> credit.low</label>
              </div>
              <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => toast('Test event sent to your endpoint')} className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Send test</button><button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Save webhook</button></div>
            </form>
          </section>
        )}

        {tab === 'appearance' && <AppearancePanel />}
      </div>

      {planOpen && (
        <Modal onClose={() => setPlanOpen(false)} title="Manage plan" subtitle="Switch your subscription tier" icon="ph-crown">
          {({ close }) => (
            <div className="space-y-2">
              {PLANS.map((p) => {
                const active = p.key === plan;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => { setPlan(p.key); toast(`Switched to the ${p.key} plan`); close(); }}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}><i className="ph-bold ph-crown" aria-hidden /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{p.key}</span><span className="block text-[11px] text-muted-foreground">{p.desc}</span></span>
                    {active && <span className="pill pill-good shrink-0">Current</span>}
                  </button>
                );
              })}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cur = mounted ? theme ?? 'system' : undefined;

  const OPTS: { key: string; label: string; icon: string; color: string }[] = [
    { key: 'light', label: 'Light', icon: 'ph-sun', color: 'text-amber-500' },
    { key: 'dark', label: 'Dark', icon: 'ph-moon-stars', color: 'text-primary' },
    { key: 'system', label: 'System', icon: 'ph-desktop', color: 'text-muted-foreground' },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 lg:p-6">
      <h2 className="display text-lg font-semibold tracking-tight">Appearance & Language</h2>
      <p className="text-xs text-muted-foreground">Customize how your workspace looks.</p>
      <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Display mode</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTS.map((o) => {
          const on = cur === o.key;
          return (
            <button key={o.key} onClick={() => setTheme(o.key)} className={`rounded-xl border-2 p-4 text-left transition hover:border-primary/50 ${on ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}>
              <i className={`ph-bold ${o.icon} text-xl ${o.color}`} aria-hidden /><p className="mt-2 text-sm font-semibold">{o.label}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:max-w-lg">
        <div><label className="lbl">Language</label><select className="field"><option>English</option></select></div>
        <div><label className="lbl">Time zone</label><select className="field"><option>(GMT-8) Los Angeles</option><option>(GMT+0) UTC</option></select></div>
      </div>
    </section>
  );
}
