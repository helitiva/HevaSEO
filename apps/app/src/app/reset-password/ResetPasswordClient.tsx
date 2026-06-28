'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetPassword } from '@/lib/auth';
import { AuthShell, AuthField, AuthError, AuthSubmit, authInputClass } from '@/components/auth/AuthShell';

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const canSubmit = password.length > 0 && confirm.length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('This reset link is missing an email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    const res = resetPassword(email, password);
    if (res.ok) { setDone(true); return; }
    setError(res.error ?? 'Could not reset your password.');
  };

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You're all set.">
        <div className="rounded-2xl border border-border bg-card p-6">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
            <i className="ph-fill ph-check-circle text-2xl" aria-hidden />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <i className="ph-bold ph-sign-in" aria-hidden /> Go to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle={email ? <>Resetting password for <span className="font-semibold text-foreground">{email}</span>.</> : 'Choose a new password for your account.'}
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">Back to sign in</Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="New password">
          <input
            type="password"
            autoComplete="new-password"
            className={authInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </AuthField>
        <AuthField label="Confirm new password">
          <input
            type="password"
            autoComplete="new-password"
            className={authInputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your new password"
          />
        </AuthField>

        {error && <AuthError>{error}</AuthError>}

        <AuthSubmit disabled={!canSubmit}>
          <i className="ph-bold ph-lock-key" aria-hidden /> Reset password
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
