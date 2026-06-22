'use client';

import { useEffect, useState } from 'react';

/** Animates a number from 0 → value on mount (easeOutCubic). Respects reduced motion. */
export function CountUp({ value, duration = 900, decimals = 0, suffix = '', className }: {
  value: number; duration?: number; decimals?: number; suffix?: string; className?: string;
}) {
  const [n, setN] = useState(value);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const display = decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString('en-US');
  return <span className={className}>{display}{suffix}</span>;
}
