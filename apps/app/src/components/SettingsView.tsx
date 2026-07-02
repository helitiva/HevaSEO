'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTheme } from 'next-themes';
import { useToast } from './Toast';
import { TeamSettings } from './TeamSettings';
import { SecurityPanel } from './settings/SecurityPanel';
import { BillingPanel } from './settings/BillingPanel';
import { ApiPanel } from './settings/ApiPanel';
import { updateProfileAction, updateNotifPrefsAction, type ProfileForm, type BillingForm, type NotifPrefs } from '@/app/(portal)/profile.actions';
import { setAppearanceAction, type MySettings } from '@/app/(portal)/settings.actions';

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

/** Two initials from a name, e.g. "Huy Vo" → "HV". Falls back to "ME". */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ME';
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

/** Controlled form values seeded from the server; saved via a server action by the caller. */
function useEditForm<T extends Record<string, string>>(initial: T) {
  const [data, setData] = useState<T>(initial);
  const field = (k: keyof T) => ({
    value: data[k],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setData((d) => ({ ...d, [k]: e.target.value })),
  });
  return { data, field };
}

/** DB-backed notification toggle (persists to the customer's notif_prefs). Defaults on when unset. */
function NotifSwitch({ id, prefs, onSet }: { id: string; prefs: NotifPrefs; onSet: (id: string, on: boolean) => void }) {
  const on = prefs[id] ?? true;
  const toggle = () => onSet(id, !on);
  return (
    <div className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} tabIndex={0}
      onClick={toggle} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } }} />
  );
}

export function SettingsView({ initialProfile, initialBilling, initialNotif, initialSettings }: { initialProfile: ProfileForm; initialBilling: BillingForm; initialNotif: NotifPrefs; initialSettings: MySettings }) {
  const [tab, setTab] = useState<TabKey>('profile');
  const toast = useToast();
  const profile = useEditForm(initialProfile);
  const [notif, setNotif] = useState<NotifPrefs>(initialNotif);
  const setNotifPref = (id: string, on: boolean) => {
    const next = { ...notif, [id]: on };
    setNotif(next);
    void updateNotifPrefsAction(next);
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
          <form onSubmit={async (e) => { e.preventDefault(); const r = await updateProfileAction(profile.data); toast(r.ok ? 'Profile saved' : r.error ?? 'Save failed', r.ok ? 'success' : 'error'); }} className="rounded-2xl border border-border bg-card p-5 lg:p-6">
            <h2 className="display text-lg font-semibold tracking-tight">Profile</h2>
            <p className="text-xs text-muted-foreground">Information shown to advisors and on invoices.</p>
            <div className="mt-5 flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white">{initials(profile.data.name)}</span>
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
              <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Cancel</button>
              <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Save changes</button>
            </div>
          </form>
        )}

        {tab === 'security' && <SecurityPanel initialTwoFactor={initialSettings.twoFactor} />}

        {tab === 'notif' && (
          <section className="rounded-2xl border border-border bg-card p-5 lg:p-6">
            <h2 className="display text-lg font-semibold tracking-tight">Notifications</h2>
            <p className="text-xs text-muted-foreground">Choose the channels and event types you want to receive.</p>
            <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Channels</p>
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">Email</p><p className="text-[11px] text-muted-foreground">{profile.data.email || 'your email'}</p></div><NotifSwitch id="notif.email" prefs={notif} onSet={setNotifPref} /></div>
              <div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">In-app</p><p className="text-[11px] text-muted-foreground">Bell & notification center</p></div><NotifSwitch id="notif.inapp" prefs={notif} onSet={setNotifPref} /></div>
              <div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">Header ticker</p><p className="text-[11px] text-muted-foreground">Scrolling notification bar</p></div><NotifSwitch id="notif.ticker" prefs={notif} onSet={setNotifPref} /></div>
            </div>
            <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Event types</p>
            <div className="divide-y divide-border">
              {['Order status changes', 'Links got indexed', 'Weekly report', 'Low credit alerts', 'Promotional emails'].map((label) => (
                <div key={label} className="flex items-center justify-between py-3"><p className="text-sm font-medium">{label}</p><NotifSwitch id={`notif.evt.${label.toLowerCase().replace(/[^a-z]+/g, '-')}`} prefs={notif} onSet={setNotifPref} /></div>
              ))}
            </div>
          </section>
        )}

        {tab === 'billing' && (
          <BillingPanel plan={initialSettings.plan} initialAutoTopup={initialSettings.autoTopup} initialPaymentMethods={initialSettings.paymentMethods} initialBilling={initialBilling} />
        )}

        {tab === 'team' && <TeamSettings />}

        {tab === 'api' && <ApiPanel initialApiKeys={initialSettings.apiKeys} initialWebhook={initialSettings.webhook} />}

        {tab === 'appearance' && <AppearancePanel initialLocale={initialSettings.locale} initialTimezone={initialSettings.timezone} />}
      </div>
    </div>
  );
}

const LANGUAGES = ['English'];
const TIMEZONES = ['(GMT-8) Los Angeles', '(GMT-5) New York', '(GMT+0) UTC', '(GMT+7) Bangkok / Hanoi', '(GMT+8) Singapore'];

function AppearancePanel({ initialLocale, initialTimezone }: { initialLocale: string; initialTimezone: string }) {
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState(initialLocale);
  const [timezone, setTimezone] = useState(initialTimezone);
  useEffect(() => setMounted(true), []);
  const cur = mounted ? theme ?? 'system' : undefined;

  const save = async (next: { locale: string; timezone: string }) => {
    const r = await setAppearanceAction(next);
    toast(r.ok ? 'Preferences saved' : r.error ?? 'Save failed', r.ok ? 'success' : 'error');
  };

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
        <div><label className="lbl">Language</label><select className="field" value={locale} onChange={(e) => { setLocale(e.target.value); void save({ locale: e.target.value, timezone }); }}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select></div>
        <div><label className="lbl">Time zone</label><select className="field" value={TIMEZONES.includes(timezone) ? timezone : ''} onChange={(e) => { setTimezone(e.target.value); void save({ locale, timezone: e.target.value }); }}>{!TIMEZONES.includes(timezone) && <option value="">{timezone || 'Select…'}</option>}{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></div>
      </div>
    </section>
  );
}
