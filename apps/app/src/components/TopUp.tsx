'use client';

import { useState } from 'react';

const PRESETS = [20, 80, 200, 400, 800];

export function TopUp() {
  const [amount, setAmount] = useState(80);
  const [custom, setCustom] = useState('');

  const pick = (n: number) => {
    setAmount(n);
    setCustom('');
  };
  const onCustom = (v: string) => {
    setCustom(v);
    const n = Number(v);
    if (n >= 5) setAmount(n);
  };
  const tooLow = custom !== '' && Number(custom) < 5;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
      <h2 className="display text-lg font-semibold tracking-tight">Top up credits by bank transfer</h2>
      <p className="text-xs text-muted-foreground">Choose an amount and scan the QR with your banking app. Credits are added automatically within 1–5 minutes.</p>

      <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Choose an amount</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {PRESETS.map((n) => (
          <button key={n} onClick={() => pick(n)} className={`amt${amount === n && custom === '' ? ' active' : ''}`}>${n}</button>
        ))}
      </div>
      <div className="mt-3">
        <label className="text-[11px] font-medium text-muted-foreground">Or enter another amount ($)</label>
        <input value={custom} onChange={(e) => onCustom(e.target.value)} type="number" min={5} step={5} className="field mt-1" placeholder="e.g. 150" />
        {tooLow && <p className="mt-1 text-[11px] font-medium text-destructive">Minimum top-up is $5.</p>}
      </div>

      <div className="mt-5 grid gap-5 rounded-xl border border-border bg-background p-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl border border-border bg-white p-2">
            <img
              alt="Bank transfer QR"
              width={190}
              height={190}
              className="block h-[190px] w-[190px] rounded-md object-contain"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(`HEVASEO INC · 004210998765 · $${amount} · HEVA HV2026`)}`}
            />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><i className="ph-bold ph-device-mobile-camera" /> Scan with your banking app / camera</span>
        </div>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2"><span className="text-muted-foreground">Bank</span><span className="font-semibold">Chase</span></div>
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2"><span className="text-muted-foreground">Account holder</span><span className="font-semibold text-right">HEVASEO INC.</span></div>
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2"><span className="text-muted-foreground">Account number</span><b className="font-mono">0042 1099 8765</b></div>
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2"><span className="text-muted-foreground">Amount</span><span className="display font-semibold text-primary">${amount}</span></div>
          <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Transfer reference</span><b className="font-mono">HEVA HV2026</b></div>
          <div className="mt-1 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <i className="ph-bold ph-warning-circle" /> Keep the exact <b>transfer reference</b> so the system can add your credits automatically.
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">Transferred but don&apos;t see your credit? Contact <a href="/support" className="font-semibold text-primary hover:underline">Support</a>.</p>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[.98]">
          <i className="ph-bold ph-check" /> I&apos;ve made the transfer
        </button>
      </div>
    </div>
  );
}
