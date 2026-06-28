'use client';
import { useState } from 'react';

// Shown after an admin provisions an account (staff / manager / admin / affiliate).
// Surfaces the login email + temp password with copy buttons, and states that the
// mock "credentials" email was sent (lib/auth pushes it to the outbox). Phase-0:
// the password is a plaintext mock — real auth will email a set-password link.
export function CredentialPanel({ email, password }: { email: string; password: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-500">
        <i className="ph-fill ph-check-circle" aria-hidden /> Account created
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        An email with these credentials was sent to {email}.
      </p>
      <div className="mt-3 space-y-2">
        <CopyRow label="Login email" value={email} icon="ph-envelope-simple" />
        <CopyRow label="Temporary password" value={password} icon="ph-key" mono />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <i className="ph-bold ph-info mt-0.5 shrink-0" aria-hidden />
        They&apos;ll be prompted to set a new password on first sign-in.
      </p>
    </div>
  );
}

function CopyRow({ label, value, icon, mono }: { label: string; value: string; icon: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { void navigator.clipboard?.writeText(value); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <i className={`ph-bold ${icon} text-muted-foreground`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`truncate text-sm ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold transition hover:bg-accent"
      >
        <i className={`ph-bold ${copied ? 'ph-check text-emerald-500' : 'ph-copy'}`} aria-hidden />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
