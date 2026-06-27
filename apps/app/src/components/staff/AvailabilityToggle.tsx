'use client';
import { useState } from 'react';
import { AVAILABILITY, availabilityMeta, type Availability } from '@/lib/availability';

// Segmented Available / Busy / OOO control. Self-set by staff; feeds the router responsiveness factor.
// Local state + toast (no backend yet). Label/color logic lives in lib/availability.ts (unit-tested).
export function AvailabilityToggle({
  initial = 'available',
  onChange,
}: {
  initial?: Availability;
  onChange?: (value: Availability) => void;
}) {
  const [value, setValue] = useState<Availability>(initial);
  const [toast, setToast] = useState<string | null>(null);

  function pick(next: Availability) {
    if (next === value) return;
    setValue(next);
    onChange?.(next);
    setToast(`Availability set to ${availabilityMeta(next).label}`);
    setTimeout(() => setToast(null), 2200);
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Set your availability" className="inline-flex rounded-xl border border-border bg-card p-1">
        {AVAILABILITY.map((opt) => {
          const m = availabilityMeta(opt);
          const on = opt === value;
          return (
            <button
              key={opt}
              role="radio"
              aria-checked={on}
              onClick={() => pick(opt)}
              className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                on ? `bg-muted ${m.text} ring-2 ${m.ring}` : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${on ? m.dot : 'bg-muted-foreground/40'}`} aria-hidden />
              {m.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        <i className={`ph-bold ${availabilityMeta(value).icon} mr-1`} aria-hidden />
        {value === 'available'
          ? 'New tasks can be routed to you.'
          : value === 'busy'
            ? 'Existing work continues; auto-routing pauses new tasks.'
            : 'You’re marked out — request time off below to lock it in.'}
      </p>
      {toast && (
        <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">
          <i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" aria-hidden />
          {toast}
        </div>
      )}
    </div>
  );
}
