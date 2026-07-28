'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from '../Toast';
import { updatePasswordAction } from '@/app/(portal)/profile.actions';
import { setTwoFactorAction, signOutOtherSessionsAction } from '@/app/(portal)/settings.actions';

/** DB-backed switch: reflects the server value and persists each toggle immediately. */
function ServerSwitch({ on, onToggle, busy }: { on: boolean; onToggle: () => void; busy?: boolean }) {
  return (
    <div className={`switch${on ? ' on' : ''}${busy ? ' opacity-60' : ''}`} role="switch" aria-checked={on} tabIndex={0}
      onClick={() => !busy && onToggle()} onKeyDown={(e) => { if (!busy && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onToggle(); } }} />
  );
}

export function SecurityPanel({ initialTwoFactor }: { initialTwoFactor: boolean }) {
  const toast = useToast();
  const [twoFactor, setTwoFactor] = useState(initialTwoFactor);
  const [tfBusy, setTfBusy] = useState(false);
  const [otherSignedOut, setOtherSignedOut] = useState(false);

  const updatePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const next = String(fd.get('new') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    if (next !== confirm) { toast('Passwords do not match', 'error'); return; }
    const r = await updatePasswordAction(next); // real Supabase auth update
    if (r.ok) { toast('Password updated'); form.reset(); } else { toast(r.error ?? 'Update failed', 'error'); }
  };

  const toggleTwoFactor = async () => {
    const next = !twoFactor;
    setTwoFactor(next); setTfBusy(true);
    const r = await setTwoFactorAction(next);
    setTfBusy(false);
    if (r.ok) toast(next ? 'Two-factor enabled — you’ll be asked for a code at next login' : 'Two-factor disabled');
    else { setTwoFactor(!next); toast(r.error ?? 'Update failed', 'error'); }
  };

  const signOutOthers = async () => {
    const r = await signOutOtherSessionsAction();
    if (r.ok) { setOtherSignedOut(true); toast('Signed out of all other sessions'); }
    else toast(r.error ?? 'Sign-out failed', 'error');
  };

  return (
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
          <div><h2 className="display text-base font-semibold tracking-tight">Two-factor authentication (2FA)</h2><p className="text-xs text-muted-foreground">Require an authenticator code at login. Your preference is saved to your account.</p></div>
          <ServerSwitch on={twoFactor} onToggle={toggleTwoFactor} busy={tfBusy} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="display text-base font-semibold tracking-tight">Login sessions</h2>
          {!otherSignedOut && <button onClick={signOutOthers} className="text-xs font-semibold text-destructive hover:underline">Sign out other sessions</button>}
        </div>
        <div className="mt-3 space-y-2.5 text-sm">
          <div className="flex items-center gap-3"><i className="ph-bold ph-desktop text-muted-foreground" aria-hidden /><div className="flex-1"><p className="font-medium">This device</p><p className="text-[11px] text-muted-foreground">Signed in · current session</p></div><span className="pill pill-good">Current</span></div>
          {otherSignedOut && <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">All other sessions have been signed out.</p>}
        </div>
      </div>
    </section>
  );
}
