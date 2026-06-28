'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, homePathForRole } from '@/lib/auth';
import { Recaptcha } from '@/components/auth/Recaptcha';
import { AuthShell, AuthField, AuthError, AuthSubmit, authInputClass } from '@/components/auth/AuthShell';

const DEMO_ACCOUNTS = [
  { email: 'admin@hevaseo.com', role: 'Admin' },
  { email: 'sofia@hevaseo.com', role: 'Manager' },
  { email: 'mai@hevaseo.com', role: 'Staff' },
  { email: 'jane@acme.com', role: 'Customer' },
  { email: 'jane@janeseo.com', role: 'Affiliate' },
];

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim() && password.length > 0 && !busy;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Please complete the reCAPTCHA');
      return;
    }
    setBusy(true);
    const res = signIn(email, password);
    if (res.ok) {
      router.push(homePathForRole(res.account.role));
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

      <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="mb-1.5 font-semibold text-foreground">Demo accounts</p>
        <ul className="space-y-0.5">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email} className="flex items-center justify-between gap-3">
              <span className="font-mono">{a.email}</span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">{a.role}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5">Password for all: <span className="font-mono font-semibold text-foreground">demo1234</span></p>
      </div>
    </AuthShell>
  );
}
