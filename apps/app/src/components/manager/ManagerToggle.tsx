'use client';

import { useState, useTransition } from 'react';

export type ToggleResult = { ok: true; message: string } | { ok: false; error: string };

const TONE = {
  amber: { pill: 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  emerald: { pill: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
} as const;

/**
 * A standing-mode switch for the manager topbar (away → auto-assign, auto-review). Owns the optimistic
 * flip + rollback + the confirmation toast; the caller supplies the copy and the server commit.
 */
export function ManagerToggle({
  initialOn, ariaLabel, icon, iconOn, label, labelOn, title, titleOn, tone, onCommit,
}: {
  initialOn: boolean;
  ariaLabel: string;
  icon: string; iconOn: string;
  label: string; labelOn: string;
  title: string; titleOn: string;
  tone: keyof typeof TONE;
  onCommit: (next: boolean) => Promise<ToggleResult>;
}) {
  const [on, setOn] = useState(initialOn);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3200); };

  const toggle = () => {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await onCommit(next);
      if (!res.ok) { setOn(!next); flash(`⚠ ${res.error}`); return; } // roll back
      flash(res.message);
    });
  };

  const t = TONE[tone];
  return (
    <div className="relative">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={ariaLabel}
        onClick={toggle}
        disabled={pending}
        title={on ? titleOn : title}
        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
          on ? t.pill : 'border-border bg-card text-muted-foreground hover:text-foreground'
        }`}
      >
        <i className={`ph-bold ${pending ? 'ph-circle-notch animate-spin' : on ? iconOn : icon}`} aria-hidden />
        <span className="hidden sm:inline">{on ? labelOn : label}</span>
        <span className={`relative h-4 w-7 shrink-0 rounded-full transition ${on ? t.dot : 'bg-muted'}`} aria-hidden>
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? 'left-[14px]' : 'left-0.5'}`} />
        </span>
      </button>
      {toast && (
        <div className="toast-in absolute right-0 top-full z-50 mt-2 w-max max-w-[17rem] rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
