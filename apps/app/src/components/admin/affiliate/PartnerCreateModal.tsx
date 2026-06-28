'use client';
import { useMemo, useState } from 'react';
import { AFFILIATE_TIERS, genCode, isCodeValid, type TierId } from '@/lib/affiliate';
import { createPartner } from '@/data/affiliateAdminStore';
import { CredentialPanel } from '@/components/admin/accounts/CredentialPanel';

// Provision a new affiliate partner. On create, it makes the AdminAffiliate row, pins
// the chosen tier, AND creates an 'affiliate' login account (lib/auth emails creds to
// the mock outbox) — then swaps to the CredentialPanel so the admin can copy them.
export function PartnerCreateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState('');
  const [niche, setNiche] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [tier, setTier] = useState<TierId>('bronze');
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  // Auto-suggest a vanity code from the name until the admin edits it themselves.
  const effectiveCode = codeTouched ? code : genCode(name || '');
  const emailValid = /.+@.+\..+/.test(email.trim());
  const codeOk = isCodeValid(effectiveCode.toUpperCase());
  const canSave = useMemo(
    () => name.trim().length > 1 && emailValid && codeOk,
    [name, emailValid, codeOk],
  );

  const save = () => {
    if (!canSave) return;
    const { account, tempPassword } = createPartner({
      name, handle, platform, niche, email, code: effectiveCode, tier,
    });
    setCreated({ email: account.email, password: tempPassword });
  };

  const inp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';
  const lbl = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-in relative grid max-h-[90vh] w-full max-w-lg grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="display text-base font-bold">{created ? 'Partner created' : 'New partner'}</p>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><i className="ph-bold ph-x" aria-hidden /></button>
        </div>

        <div className="scrollbar-thin space-y-4 overflow-y-auto px-5 py-4">
          {created ? (
            <CredentialPanel email={created.email} password={created.password} />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={lbl}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Rivera" className={inp} autoFocus /></div>
                <div><label className={lbl}>Handle</label><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@janeseo" className={inp} /></div>
                <div><label className={lbl}>Platform</label><input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="YouTube" className={inp} /></div>
                <div><label className={lbl}>Niche</label><input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="SEO & Marketing" className={inp} /></div>
              </div>
              <div><label className={lbl}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@janeseo.com" className={inp} />{email && !emailValid && <p className="mt-1 text-[11px] text-rose-500">Enter a valid email.</p>}</div>
              <div>
                <label className={lbl}>Referral code</label>
                <input value={effectiveCode} onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toUpperCase()); }} placeholder="JANESEO" className={`${inp} font-mono uppercase`} />
                {!codeOk && effectiveCode && <p className="mt-1 text-[11px] text-rose-500">3–20 letters/numbers only.</p>}
              </div>
              <div>
                <label className={lbl}>Starting tier</label>
                <div className="flex flex-wrap gap-1.5">
                  {AFFILIATE_TIERS.map((t) => { const on = tier === t.id; return (
                    <button key={t.id} type="button" onClick={() => setTier(t.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold capitalize transition ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                      <i className="ph-fill ph-crown-simple text-[11px]" aria-hidden /> {t.label} · {Math.round(t.rate * 100)}%
                    </button>
                  ); })}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">Pins the tier regardless of volume — clearable later from the partner row.</p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {created ? (
            <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-check" aria-hidden /> Done</button>
          ) : (
            <>
              <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
              <button onClick={save} disabled={!canSave} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 disabled:opacity-40"><i className="ph-bold ph-user-plus" aria-hidden /> Create partner</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
