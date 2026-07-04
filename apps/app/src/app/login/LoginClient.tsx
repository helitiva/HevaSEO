'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPassword, homePathForRole } from '@/lib/auth';
import { Recaptcha } from '@/components/auth/Recaptcha';
import { AuthShell, AuthField, AuthError, AuthSubmit, authInputClass } from '@/components/auth/AuthShell';

// One-click dev logins (skip reCAPTCHA) — password is demo1234 for every seeded account.
const QUICK_LOGINS = [
  { email: 'jane@acme.com', label: 'Customer', icon: 'ph-user' },
  { email: 'mai@hevaseo.com', label: 'Staff', icon: 'ph-headset' },
  { email: 'sofia@hevaseo.com', label: 'Manager', icon: 'ph-users-three' },
  { email: 'admin@hevaseo.com', label: 'Admin', icon: 'ph-shield-star' },
  { email: 'jane@janeseo.com', label: 'Affiliate', icon: 'ph-megaphone-simple' },
];

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);

  const canSubmit = email.trim() && password.length > 0 && !busy;

  // Dev shortcut: sign in as a seeded role in one click, bypassing reCAPTCHA + the form.
  const quickLogin = async (loginEmail: string) => {
    setError(''); setQuick(loginEmail);
    const res = await signInWithPassword(loginEmail, 'demo1234');
    if (res.ok) { router.replace(homePathForRole(res.role)); router.refresh(); return; }
    setError(res.error); setQuick(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Please complete the reCAPTCHA');
      return;
    }
    setBusy(true);
    const res = await signInWithPassword(email, password);
    if (res.ok) {
      router.replace(homePathForRole(res.role));
      router.refresh();
      return;
    }
    setError(res.error);
    setBusy(false);
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your HevaSEO workspace."
      footer={
        <>
          <Link href="/forgot-password" className="font-semibold text-primary hover:underline">Forgot password?</Link>
          <span className="mx-2 text-border">·</span>
          <span>Don&apos;t have an account? </span>
          <Link href="/register" className="font-semibold text-primary hover:underline">Sign up</Link>
        </>
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
        <AuthField label="Password">
          <input
            type="password"
            autoComplete="current-password"
            className={authInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </AuthField>

        <Recaptcha onVerify={setToken} />

        {error && <AuthError>{error}</AuthError>}

        <AuthSubmit disabled={!canSubmit}>
          <i className="ph-bold ph-sign-in" aria-hidden /> Sign in
        </AuthSubmit>
      </form>

      <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <i className="ph-bold ph-lightning text-primary" aria-hidden /> Log in as
          <span className="font-normal">· dev shortcut, skips reCAPTCHA</span>
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK_LOGINS.map((q) => (
            <button
              key={q.email}
              type="button"
              onClick={() => quickLogin(q.email)}
              disabled={busy || quick !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-semibold transition hover:border-primary/50 hover:bg-accent disabled:opacity-50"
            >
              <i className={`ph-bold ${quick === q.email ? 'ph-circle-notch animate-spin' : q.icon}`} aria-hidden /> {q.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">All seeded accounts · password <span className="font-mono font-semibold text-foreground/80">demo1234</span></p>
      </div>
    </AuthShell>
  );
}
