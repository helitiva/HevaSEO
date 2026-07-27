'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUpCustomer } from '@/lib/auth';
import { claimReferralAction } from './referral.actions';
import { Recaptcha } from '@/components/auth/Recaptcha';
import { AuthShell, AuthField, AuthError, AuthSubmit, authInputClass } from '@/components/auth/AuthShell';

const EMAIL_RE = /\S+@\S+\.\S+/;

export function RegisterClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit =
    name.trim() && email.trim() && password.length > 0 && confirm.length > 0 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!EMAIL_RE.test(email)) { setError('Please enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    // reCAPTCHA is required in every deployed environment. It is skipped only under `next dev`, where the
    // widget has no real keys and the signup path (incl. referral attribution) has to be walkable locally.
    if (!token && process.env.NODE_ENV !== 'development') { setError('Please complete the reCAPTCHA'); return; }

    setBusy(true);
    const res = await signUpCustomer({ name, email, password });
    if (res.ok) {
      if (res.signedIn) {
        // Claim this signup for the affiliate whose link brought them here (30-day `heva_ref` cookie).
        // Needs the session, so it runs only once signed in; best-effort and never blocks the redirect.
        await claimReferralAction();
        router.replace('/dashboard');
        router.refresh();
      } else {
        setNotice('Check your email to confirm your account, then sign in.');
        setBusy(false);
      }
      return;
    }
    setError(res.error);
    setBusy(false);
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start managing your SEO with HevaSEO."
      footer={
        <>
          <span>Already have an account? </span>
          <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Full name">
          <input
            type="text"
            autoComplete="name"
            className={authInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </AuthField>
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
            autoComplete="new-password"
            className={authInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </AuthField>
        <AuthField label="Confirm password">
          <input
            type="password"
            autoComplete="new-password"
            className={authInputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
          />
        </AuthField>

        <Recaptcha onVerify={setToken} />

        {error && <AuthError>{error}</AuthError>}
        {notice && (
          <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">{notice}</p>
        )}

        <AuthSubmit disabled={!canSubmit}>
          <i className="ph-bold ph-user-plus" aria-hidden /> Create account
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
