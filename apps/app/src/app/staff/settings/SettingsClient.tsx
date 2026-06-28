'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AvailabilityToggle } from '@/components/staff/AvailabilityToggle';
import { validateLeave, leaveDays, leaveStatusMeta, type LeaveStatus } from '@/lib/leave';
import {
  leaveSummary, workingHoursSummary, LEAVE_ALLOWANCE, DEFAULT_NOTIF_PREFS, LANGUAGES, DATE_FORMATS,
  type NotifPref,
} from '@/lib/staffSettings';
import { MOCK_TODAY } from '@/lib/today';

interface Profile { name: string; role: string; email: string; tz: string; since: string }
interface Skill { key: string; label: string; icon: string; color: string }
interface DayHours { day: number; on: boolean; start: string; end: string }
interface SeedLeave { id: string; from: string; to: string; reason: string }
interface LeaveRow { id: string; from: string; to: string; reason: string; status: LeaveStatus }

export function SettingsClient({ profile, skills, hours, seededLeave }: { profile: Profile; skills: Skill[]; hours: DayHours[]; seededLeave: SeedLeave[] }) {
  // One source of truth for time off: the shared schedule (seeded = approved) + this session's requests.
  const seeded: LeaveRow[] = seededLeave.map((l) => ({ ...l, status: 'approved' as LeaveStatus }));
  const [requests, setRequests] = useState<LeaveRow[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<NotifPref[]>(DEFAULT_NOTIF_PREFS);
  const [twoFactor, setTwoFactor] = useState(false);
  const [language, setLanguage] = useState('en');
  const [dateFmt, setDateFmt] = useState('iso');
  const [toast, setToast] = useState<string | null>(null);

  const allLeave = [...requests, ...seeded];
  const balance = leaveSummary(allLeave, LEAVE_ALLOWANCE);
  const schedule = workingHoursSummary(hours);
  const days = from && to ? leaveDays(from, to) : null;
  const today = MOCK_TODAY;

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };

  function submitLeave() {
    const err = validateLeave({ from, to, reason });
    if (err) { setError(err); return; }
    setError(null);
    setRequests((xs) => [{ id: `lv-${Date.now()}`, from, to, reason: reason.trim(), status: 'pending' }, ...xs]);
    setFrom(''); setTo(''); setReason('');
    flash('Request sent for approval');
  }
  const setNotif = (id: string, ch: 'email' | 'inApp', val: boolean) =>
    setNotifs((xs) => xs.map((n) => (n.id === id ? { ...n, [ch]: val } : n)));

  return (
    <div className="space-y-5">
      {/* ───────────── Account ───────────── */}
      <SectionLabel icon="ph-user-circle" title="Account" />

      <Card icon="ph-identification-card" title="Profile" action={<RequestBtn onClick={() => flash('Profile change requested — admin will review.')} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={profile.name} />
          <Field label="Role" value={profile.role} />
          <Field label="Email" value={profile.email} />
          <Field label="Timezone" value={profile.tz} />
          <Field label="Joined" value={profile.since} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-lock-simple mr-1" aria-hidden />Profile details are admin-managed — use “Request change” to ask for an edit.</p>
      </Card>

      <Card icon="ph-certificate" title="Skills" action={<RequestBtn onClick={() => flash('Skill change requested — admin will confirm.')} />}>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills set yet — admin assigns these.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((k) => (
              <span key={k.key} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-sm font-medium">
                <i className={`ph-fill ${k.icon}`} style={{ color: k.color }} aria-hidden />{k.label}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card icon="ph-shield-check" title="Account & security">
        <ul className="divide-y divide-border">
          <Row2 title="Password" sub="Last changed by admin">
            <button onClick={() => flash('Password resets are handled by admin in this demo.')} className="btn-ghost">Change</button>
          </Row2>
          <Row2 title="Two-factor authentication" sub={twoFactor ? 'Enabled — codes via authenticator app' : 'Add a second step at sign-in'}>
            <Switch on={twoFactor} label="Two-factor authentication" onChange={(v) => { setTwoFactor(v); flash(v ? '2FA enabled.' : '2FA disabled.'); }} />
          </Row2>
          <Row2 title="Sign out" sub="End your session on this device">
            <Link href="/" className="btn-ghost">Sign out <i className="ph-bold ph-sign-out" aria-hidden /></Link>
          </Row2>
        </ul>
      </Card>

      {/* ───────────── Work ───────────── */}
      <SectionLabel icon="ph-briefcase" title="Work" />

      <Card icon="ph-circle-half" title="Availability" action={
        <Link href="/staff/calendar" className="btn-ghost">Schedule &amp; handoff <i className="ph-bold ph-arrow-up-right" aria-hidden /></Link>
      }>
        <AvailabilityToggle initial="available" />
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <i className="ph-bold ph-clock text-primary" aria-hidden />
          Working {schedule.days} day{schedule.days === 1 ? '' : 's'}/week · ~{schedule.weekly}h. Edit working hours, time-off &amp; handoff on the <Link href="/staff/calendar" className="font-semibold text-primary hover:underline">Calendar</Link>.
        </p>
      </Card>

      <Card icon="ph-airplane-takeoff" title="Time off">
        {/* leave balance */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Stat label="Allowance" value={`${balance.allowance}d`} />
          <Stat label="Used" value={`${balance.used}d`} tone={balance.used >= balance.allowance ? 'warn' : undefined} />
          <Stat label="Remaining" value={`${balance.remaining}d`} tone={balance.remaining <= 3 ? 'warn' : 'good'} />
        </div>
        {balance.pending > 0 && <p className="mb-3 text-[11px] text-muted-foreground"><i className="ph-bold ph-hourglass-medium mr-1 text-amber-500" aria-hidden />{balance.pending} day{balance.pending === 1 ? '' : 's'} awaiting approval.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">From</span>
            <input type="date" min={today} value={from} onChange={(e) => { setFrom(e.target.value); setError(null); }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">To</span>
            <input type="date" min={from || today} value={to} onChange={(e) => { setTo(e.target.value); setError(null); }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Reason</span>
          <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} rows={2} placeholder="A short note for your admin"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={submitLeave}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
            <i className="ph-bold ph-paper-plane-tilt" aria-hidden /> Send request
          </button>
          {days !== null && !error && <span className="text-xs text-muted-foreground">{days} day{days === 1 ? '' : 's'} off</span>}
        </div>
        {error && <p className="mt-2 text-xs font-semibold text-destructive"><i className="ph-bold ph-warning-circle mr-1" aria-hidden />{error}</p>}

        {allLeave.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {allLeave.map((r) => {
              const meta = leaveStatusMeta(r.status);
              return (
                <li key={r.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <i className="ph-bold ph-calendar-blank text-muted-foreground" aria-hidden />
                  <span className="font-medium">{r.from} → {r.to}</span>
                  <span className="truncate text-xs text-muted-foreground">{r.reason}</span>
                  <span className={`pill ${meta.pill} ml-auto shrink-0`}>{meta.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ───────────── Preferences ───────────── */}
      <SectionLabel icon="ph-sliders-horizontal" title="Preferences" />

      <Card icon="ph-paint-brush-broad" title="Appearance & locale">
        <ul className="divide-y divide-border">
          <Row2 title="Theme" sub="Light or dark"><ThemeToggle /></Row2>
          <Row2 title="Language" sub="Interface language">
            <select value={language} onChange={(e) => { setLanguage(e.target.value); flash('Language preference saved.'); }} className="select-sm">
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </Row2>
          <Row2 title="Date format" sub="How dates display">
            <select value={dateFmt} onChange={(e) => { setDateFmt(e.target.value); flash('Date format saved.'); }} className="select-sm">
              {DATE_FORMATS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Row2>
        </ul>
      </Card>

      <Card icon="ph-bell-ringing" title="Notifications">
        <div className="mb-2 hidden grid-cols-[1fr_auto_auto] gap-x-6 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
          <span />
          <span className="w-12 text-center">Email</span>
          <span className="w-12 text-center">In-app</span>
        </div>
        <ul className="divide-y divide-border">
          {notifs.map((n) => (
            <li key={n.id} className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-2.5 sm:grid-cols-[1fr_auto_auto]">
              <div className="min-w-0">
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-[11px] text-muted-foreground">{n.desc}</p>
              </div>
              <label className="flex w-12 items-center justify-center gap-1 sm:gap-0">
                <span className="text-[10px] text-muted-foreground sm:hidden">Email</span>
                <Switch on={n.email} label={`${n.label} email`} onChange={(v) => setNotif(n.id, 'email', v)} />
              </label>
              <label className="flex w-12 items-center justify-center gap-1 sm:gap-0">
                <span className="text-[10px] text-muted-foreground sm:hidden">In-app</span>
                <Switch on={n.inApp} label={`${n.label} in-app`} onChange={(v) => setNotif(n.id, 'inApp', v)} />
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card icon="ph-wallet" title="Payments">
        <Row2 title="Payout methods" sub="Bank, PayPal or Wise — manage on Finance">
          <Link href="/staff/finance" className="btn-ghost">Manage <i className="ph-bold ph-arrow-up-right" aria-hidden /></Link>
        </Row2>
      </Card>

      {toast && (
        <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">
          <i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" aria-hidden />{toast}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <p className="flex items-center gap-2 px-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      <i className={`ph-bold ${icon} text-primary`} aria-hidden /> {title}
    </p>
  );
}

function Card({ icon, title, action, children }: { icon: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="kcard">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} aria-hidden /> {title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function Row2({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  const color = tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-500' : '';
  return (
    <div className="rounded-xl border border-border p-2.5 text-center">
      <p className={`display text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function RequestBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="btn-ghost"><i className="ph-bold ph-pencil-simple-line" aria-hidden /> Request change</button>;
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}
