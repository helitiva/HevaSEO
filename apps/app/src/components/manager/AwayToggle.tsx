'use client';

import { useState, useTransition } from 'react';
import { setAwayAutoAssignAction } from '@/app/manager/away.actions';

/**
 * Away → auto-assign switch, lives in the manager topbar. While ON the manager is marked away and newly
 * placed pod-serviceable orders route themselves to the least-loaded suitable staffer; flipping it on also
 * sweeps the current unassigned queue and reports how many orders were routed.
 */
export function AwayToggle({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3200); };

  const toggle = () => {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setAwayAutoAssignAction(next);
      if (!res.ok) {
        setOn(!next); // roll back
        flash(`⚠ ${res.error}`);
        return;
      }
      if (res.on) {
        flash(res.assigned > 0
          ? `Away on · auto-assigned ${res.assigned} order${res.assigned > 1 ? 's' : ''} to your pod`
          : 'Away on · new orders will auto-assign to your pod');
      } else {
        flash('Away off · you’re back — new orders wait for you');
      }
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Auto-assign orders while away"
        onClick={toggle}
        disabled={pending}
        title={on ? 'Away — new orders auto-assign to your pod. Click to turn off.' : 'Turn on to auto-assign new orders while you’re away.'}
        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
          on
            ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
            : 'border-border bg-card text-muted-foreground hover:text-foreground'
        }`}
      >
        <i className={`ph-bold ${pending ? 'ph-circle-notch animate-spin' : on ? 'ph-airplane-tilt' : 'ph-airplane'}`} aria-hidden />
        <span className="hidden sm:inline">{on ? 'Away · auto-assign' : 'Auto-assign'}</span>
        <span
          className={`relative h-4 w-7 shrink-0 rounded-full transition ${on ? 'bg-amber-500' : 'bg-muted'}`}
          aria-hidden
        >
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? 'left-[14px]' : 'left-0.5'}`} />
        </span>
      </button>
      {toast && (
        <div className="toast-in absolute right-0 top-full z-50 mt-2 w-max max-w-[16rem] rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
