'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerAffiliateSelf } from '@/data/affiliateAdminStore';
import { AFFILIATE_TIERS } from '@/lib/affiliate';
import { Recaptcha } from '@/components/auth/Recaptcha';
import { AuthShell, AuthField, AuthError, AuthSubmit, authInputClass } from '@/components/auth/AuthShell';

const PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'X', 'Blog', 'Facebook', 'LinkedIn', 'Other'];
const topRate = Math.round(Math.max(...AFFILIATE_TIERS.map((t) => t.rate)) * 100);

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function AffiliateRegisterClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [niche, setNiche] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim() && emailOk(email) && password.length >= 6 && password === confirm && !busy;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!emailOk(email)) return setError('Please enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    if (!token) return setError('Please complete the reCAPTCHA.');
    setBusy(true);
    const res = registerAffiliateSelf({ name, email, password, handle, platform, niche });
    if (res.ok) { router.push('/affiliate'); return; }
    setError(res.error);
    setBusy(false);
  };

  return (
    <AuthShell
      title="Become a HevaSEO affiliate"
      subtitle="Apply in under a minute. Your account activates instantly; your tier grows with referred volume."
      aside={<AffiliateAside />}
      footer={<><span>Already a partner? </span><Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Full name">
          <input className={authInputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Rivera" autoComplete="name" />
        </AuthField>
        <AuthField label="Email">
          <input type="email" autoComplete="email" className={authInputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@channel.com" />
        </AuthField>
        <div className="grid grid-cols-2 gap-3">
          <AuthField label="Handle">
            <input className={authInputClass} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" />
          </AuthField>
          <AuthField label="Platform">
            <select className={authInputClass} value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </AuthField>
        </div>
        <AuthField label="Niche" hint="What's your audience about?">
          <input className={authInputClass} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="SEO & Marketing" />
        </AuthField>
        <div className="grid grid-cols-2 gap-3">
          <AuthField label="Password">
            <input type="password" autoComplete="new-password" className={authInputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </AuthField>
          <AuthField label="Confirm">
            <input type="password" autoComplete="new-password" className={authInputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
          </AuthField>
        </div>

        <Recaptcha onVerify={setToken} />

        {error && <AuthError>{error}</AuthError>}

        <AuthSubmit disabled={!canSubmit}>
          <i className="ph-bold ph-rocket-launch" aria-hidden /> Create affiliate account
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}

function AffiliateAside() {
  const points = [
    { icon: 'ph-percent', text: `Up to ${topRate}% commission — your rate climbs with referred volume.` },
    { icon: 'ph-repeat', text: 'Recurring & lifetime: every repeat order keeps paying you.' },
    { icon: 'ph-lightning', text: 'Instant approval — your referral link works right away.' },
    { icon: 'ph-chart-line-up', text: 'Real-time dashboard for clicks, signups, volume & earnings.' },
  ];
  return (
    <div className="max-w-md">
      <p className="display text-3xl font-bold leading-tight">Earn on every referral.</p>
      <p className="mt-3 text-sm text-white/70">Join the HevaSEO partner program and turn your audience into recurring income.</p>
      <ul className="mt-8 space-y-3">
        {points.map((p) => (
          <li key={p.icon} className="flex items-start gap-3 text-sm text-white/90">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15"><i className={`ph-bold ${p.icon}`} aria-hidden /></span>
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
