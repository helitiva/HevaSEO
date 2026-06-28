'use client';
import { useEffect, useState } from 'react';

function parts(toMs: number) {
  const s = Math.max(0, Math.floor(toMs / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/** Live ticking countdown to a deadline — the core urgency primitive. */
export function Countdown({ to, className = '' }: { to: string; className?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null); // null until mounted (avoids hydration mismatch)

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const p = parts(target - (now ?? target));
  const Box = ({ v, l }: { v: number; l: string }) => (
    <span className="inline-flex flex-col items-center">
      <span className="min-w-[2ch] rounded-md bg-foreground/90 px-1.5 py-0.5 text-center font-mono text-sm font-bold tabular-nums text-background">
        {String(v).padStart(2, '0')}
      </span>
      <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{l}</span>
    </span>
  );

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} suppressHydrationWarning>
      <Box v={p.d} l="days" /><Box v={p.h} l="hrs" /><Box v={p.m} l="min" /><Box v={p.s} l="sec" />
    </span>
  );
}
