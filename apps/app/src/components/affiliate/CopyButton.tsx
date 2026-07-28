'use client';
import { useState } from 'react';

/** Copy-to-clipboard button with a brief "Copied" confirmation. Two variants: a
 *  full labelled button, or an icon-only square (set `iconOnly`). */
export function CopyButton({
  value, label = 'Copy', iconOnly = false, className = '',
}: { value: string; label?: string; iconOnly?: boolean; className?: string }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard blocked (e.g. insecure context) — fail quietly, nothing to recover */
    }
  };

  if (iconOnly) {
    return (
      <button
        type="button" onClick={copy} aria-label={done ? 'Copied' : label}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground ${className}`}
      >
        <i className={`ph-bold ${done ? 'ph-check text-emerald-500' : 'ph-copy'}`} aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button" onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold transition hover:bg-muted ${done ? 'text-emerald-600' : ''} ${className}`}
    >
      <i className={`ph-bold ${done ? 'ph-check' : 'ph-copy'}`} aria-hidden />
      {done ? 'Copied' : label}
    </button>
  );
}
