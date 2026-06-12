'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

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

const INDUSTRIES = ['E-commerce', 'Retail / Supermarket', 'Healthcare / Dental / Clinics', 'Aesthetics / Spa / Beauty', 'Real estate', 'Education / Training', 'Travel / Hospitality', 'Restaurants / F&B', 'Finance / Insurance', 'Technology / Software / SaaS', 'Construction / Interiors', 'Automotive', 'Fashion / Cosmetics', 'Legal / Business consulting', 'Manufacturing / Industrial', 'Logistics / Transportation', 'Agriculture / Food', 'Events / Entertainment'];

function Switch({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return <div className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => setOn((v) => !v)} />;
}

export function SettingsView() {
  const [tab, setTab] = useState<TabKey>('profile');

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[220px_1fr]">
      {/* tab nav */}
      <aside className="lg:sticky lg:top-[84px] h-fit rounded-2xl border border-border bg-card p-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`set-tab${tab === t.key ? ' active' : ''}`}>
            <i className={`ph-bold ${t.icon}`} /> {t.label}
          </button>
        ))}
      </aside>

      <div>
        {tab === 'profile' && (
          <section className="rounded-2xl border border-border bg-card p-5 lg:p-6">
            <h2 className="display text-lg font-semibold tracking-tight">Profile</h2>
            <p className="text-xs text-muted-foreground">Information shown to advisors and on invoices.</p>
            <div className="mt-5 flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white">HV</span>
              <div className="flex gap-2">
                <button className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent">Change photo</button>
                <button className="rounded-lg px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10">Remove</button>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><label className="lbl">Full name</label><input className="field" defaultValue="Huy Nguyen" /></div>
              <div><label className="lbl">Email</label><input className="field" defaultValue="huy@hevashop.com" /></div>
              <div><label className="lbl">Phone number</label><input className="field" defaultValue="+1 (415) 555-0142" /></div>
              <div><label className="lbl">Company</label><input className="field" defaultValue="HevaShop JSC" /></div>
              <div>
                <label className="lbl">Industry</label>
                <select className="field" defaultValue="E-commerce">{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select>
              </div>
              <div><label className="lbl">Default website</label><input className="field" defaultValue="hevashop.com" /></div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Cancel</button>
              <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Save changes</button>
            </div>
          </section>
        )}

        {tab === 'security' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-lg font-semibold tracking-tight">Change password</h2>
              <div className="mt-4 grid gap-4 sm:max-w-md">
                <div><label className="lbl">Current password</label><input type="password" className="field" placeholder="Enter your current password" autoComplete="current-password" /></div>
                <div><label className="lbl">New password</label><input type="password" className="field" placeholder="At least 8 characters" autoComplete="new-password" /></div>
                <div><label className="lbl">Confirm new password</label><input type="password" className="field" autoComplete="new-password" /></div>
              </div>
              <div className="mt-4"><button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Update password</button></div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="display text-base font-semibold tracking-tight">Two-factor authentication (2FA)</h2><p className="text-xs text-muted-foreground">Add security with an OTP code at login.</p></div>
                <Switch defaultOn />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-base font-semibold tracking-tight">Login sessions</h2>
              <div className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center gap-3"><i className="ph-bold ph-desktop text-muted-foreground" /><div className="flex-1"><p className="font-medium">Chrome · macOS</p><p className="text-[11px] text-muted-foreground">San Francisco · This device</p></div><span className="pill pill-good">Current</span></div>
                <div className="flex items-center gap-3"><i className="ph-bold ph-device-mobile text-muted-foreground" /><div className="flex-1"><p className="font-medium">Safari · iPhone</p><p className="text-[11px] text-muted-foreground">San Francisco · 2 days ago</p></div><button className="text-xs font-semibold text-destructive hover:underline">Sign out</button></div>
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
              <div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">Email</p><p className="text-[11px] text-muted-foreground">huy@hevashop.com</p></div><Switch defaultOn /></div>
              <div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">In-app</p><p className="text-[11px] text-muted-foreground">Bell & notification center</p></div><Switch defaultOn /></div>
              <div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">Header ticker</p><p className="text-[11px] text-muted-foreground">Scrolling notification bar</p></div><Switch defaultOn /></div>
            </div>
            <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Event types</p>
            <div className="divide-y divide-border">
              {[['Order status changes', true], ['Links got indexed', true], ['Weekly report', true], ['Low credit alerts', true], ['Promotional emails', false]].map(([label, on]) => (
                <div key={label as string} className="flex items-center justify-between py-3"><p className="text-sm font-medium">{label}</p><Switch defaultOn={on as boolean} /></div>
              ))}
            </div>
          </section>
        )}

        {tab === 'billing' && (
          <section className="space-y-4">
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400/20 text-amber-500"><i className="ph-fill ph-crown text-xl" /></span>
                  <div><p className="display text-lg font-semibold">VIP plan</p><p className="text-xs text-muted-foreground">15% off every order · priority support</p></div>
                </div>
                <button className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Manage plan</button>
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-primary/20 pt-4">
                <div><p className="text-xs text-muted-foreground">Credit balance</p><p className="display text-2xl font-semibold tracking-tight">$179</p></div>
                <a href="/credit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]"><i className="ph-bold ph-plus" /> Top up credits</a>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="display text-base font-semibold tracking-tight">Auto top-up</h2><p className="text-xs text-muted-foreground">Automatically top up when your balance runs low so orders aren&apos;t interrupted.</p></div>
                <Switch />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:max-w-md">
                <div><label className="lbl">When balance falls below</label><input className="field" defaultValue="$40" /></div>
                <div><label className="lbl">Top up</label><input className="field" defaultValue="$199" /></div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <div className="flex items-center justify-between"><h2 className="display text-base font-semibold tracking-tight">Payment methods</h2><button className="text-xs font-semibold text-primary hover:underline">+ Add</button></div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                <i className="ph-bold ph-credit-card text-xl text-primary" />
                <div className="flex-1 text-sm"><p className="font-medium">Visa •••• 4242</p><p className="text-[11px] text-muted-foreground">Expires 08/27</p></div>
                <span className="pill pill-good">Default</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-base font-semibold tracking-tight">Billing information (VAT)</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div><label className="lbl">Company name</label><input className="field" defaultValue="HevaShop Inc." /></div>
                <div><label className="lbl">Tax ID</label><input className="field" defaultValue="0312345678" /></div>
                <div className="sm:col-span-2"><label className="lbl">Address</label><input className="field" defaultValue="123 Market St, San Francisco, CA" /></div>
              </div>
              <div className="mt-4 flex justify-end"><button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Save details</button></div>
            </div>
          </section>
        )}

        {tab === 'team' && (
          <section className="rounded-2xl border border-border bg-card p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="display text-lg font-semibold tracking-tight">Team</h2><p className="text-xs text-muted-foreground">Invite teammates to help manage projects &amp; orders.</p></div>
              <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]"><i className="ph-bold ph-user-plus" /> Invite member</button>
            </div>
            <div className="mt-5 space-y-2.5">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">HV</span>
                <div className="flex-1 text-sm"><p className="font-medium">Huy Nguyen (you)</p><p className="text-[11px] text-muted-foreground">huy@hevashop.com</p></div>
                <span className="pill" style={{ background: '#f59e0b1f', color: '#d97706' }}>Owner</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-xs font-bold">OC</span>
                <div className="flex-1 text-sm"><p className="font-medium">Olivia Chen</p><p className="text-[11px] text-muted-foreground">olivia@hevaseo.com</p></div>
                <span className="pill pill-good">Admin</span>
                <button className="text-muted-foreground transition hover:text-destructive"><i className="ph-bold ph-dots-three-vertical" /></button>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-xs font-bold">MT</span>
                <div className="flex-1 text-sm"><p className="font-medium">Marcus Tran</p><p className="text-[11px] text-muted-foreground">marcus@hevashop.com</p></div>
                <span className="pill" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>Member</span>
                <button className="text-muted-foreground transition hover:text-destructive"><i className="ph-bold ph-dots-three-vertical" /></button>
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">The Agency plan supports multiple sub-accounts &amp; per-project permissions.</p>
          </section>
        )}

        {tab === 'api' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-lg font-semibold tracking-tight">API Key</h2>
              <p className="text-xs text-muted-foreground">Use this to integrate HevaSEO into your systems.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input className="field font-mono" style={{ maxWidth: '24rem' }} defaultValue="sk_live_••••••••••••••••8f2a" readOnly />
                <button className="rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-semibold transition hover:bg-accent"><i className="ph-bold ph-copy" /> Copy</button>
                <button className="rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10"><i className="ph-bold ph-arrows-clockwise" /> Regenerate</button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
              <h2 className="display text-base font-semibold tracking-tight">Webhook</h2>
              <p className="text-xs text-muted-foreground">Receive real-time events sent to your URL.</p>
              <div className="mt-4"><label className="lbl">Endpoint URL</label><input className="field" placeholder="https://yourapp.com/webhooks/hevaseo" /></div>
              <p className="mt-4 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Outbound events</p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-[hsl(var(--primary))]" /> order.created</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-[hsl(var(--primary))]" /> order.completed</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-[hsl(var(--primary))]" /> index.done</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-[hsl(var(--primary))]" /> credit.low</label>
              </div>
              <div className="mt-4 flex justify-end gap-2"><button className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Send test</button><button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Save webhook</button></div>
            </div>
          </section>
        )}

        {tab === 'appearance' && <AppearancePanel />}
      </div>
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
              <i className={`ph-bold ${o.icon} text-xl ${o.color}`} /><p className="mt-2 text-sm font-semibold">{o.label}</p>
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
