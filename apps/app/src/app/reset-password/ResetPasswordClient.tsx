'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthShell, AuthField, AuthError, AuthSubmit, authInputClass } from '@/components/auth/AuthShell';

// Real GoTrue recovery (replaces the localStorage mock, which never changed any actual password).
// The email link lands here in one of two shapes; both are exchanged for a session:
//   · ?code=…                       — PKCE flow (GoTrue's verify endpoint redirected here)
//   · ?token_hash=…&type=recovery   — token-hash email template / admin generateLink
// Once a session exists, updateUser({ password }) performs the actual reset.
type LinkState = 'checking' | 'ready' | 'invalid';

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    let alive = true;
    const settle = (ok: boolean) => { if (alive) setLinkState(ok ? 'ready' : 'invalid'); };
    void (async () => {
      if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        settle(!e);
        return;
      }
      if (tokenHash) {
        const { error: e } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
        settle(!e);
        return;
      }
      // No token in the URL — usable only if the exchange already established a session.
      const { data } = await supabase.auth.getSession();
      settle(Boolean(data.session));
    })();
    return () => { alive = false; };
  }, [searchParams]);

  const canSubmit = linkState === 'ready' && password.length > 0 && confirm.length > 0 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) { setError(updateError.message || 'Could not reset your password.'); setBusy(false); return; }
    setDone(true);
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

  if (linkState === 'invalid') {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is invalid or has expired.">
        <div className="rounded-2xl border border-border bg-card p-6">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-rose-500/15 text-rose-600">
            <i className="ph-fill ph-link-break text-2xl" aria-hidden />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            Password reset links are single-use and expire quickly. Request a fresh one and try again.
          </p>
          <Link
            href="/forgot-password"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <i className="ph-bold ph-arrow-counter-clockwise" aria-hidden /> Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password for your account."
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
            disabled={linkState !== 'ready'}
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
            disabled={linkState !== 'ready'}
          />
        </AuthField>

        {linkState === 'checking' && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <i className="ph-bold ph-circle-notch animate-spin" aria-hidden /> Verifying your reset link…
          </p>
        )}
        {error && <AuthError>{error}</AuthError>}

        <AuthSubmit disabled={!canSubmit}>
          <i className="ph-bold ph-lock-key" aria-hidden /> Reset password
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
