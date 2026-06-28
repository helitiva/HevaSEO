'use client';
import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/auth';
import { Recaptcha } from '@/components/auth/Recaptcha';
import { AuthShell, AuthField, AuthError, AuthSubmit, authInputClass } from '@/components/auth/AuthShell';

const EMAIL_RE = /\S+@\S+\.\S+/;

export function ForgotPasswordClient() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email)) { setError('Please enter a valid email address.'); return; }
    if (!token) { setError('Please complete the reCAPTCHA'); return; }
    requestPasswordReset(email);
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="Password reset requested."
      >
        <div className="rounded-2xl border border-border bg-card p-6">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
            <i className="ph-fill ph-envelope-simple text-2xl" aria-hidden />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            If an account exists for that email, we&apos;ve sent a reset link.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <i className="ph-bold ph-arrow-left" aria-hidden /> Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">Back to sign in</Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Email">
          <input
            type="email"
            autoComplete="email"
            className={authInputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </AuthField>

        <Recaptcha onVerify={setToken} />

        {error && <AuthError>{error}</AuthError>}

        <AuthSubmit disabled={!canSubmit}>
          <i className="ph-bold ph-paper-plane-tilt" aria-hidden /> Send reset link
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
