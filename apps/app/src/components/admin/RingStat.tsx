import type { CSSProperties } from 'react';

// Conic progress ring (reuses the `.ring` class from dashboard.css, driven by --p).
export function RingStat({ pct }: { pct: number }) {
  return (
    <div className="ring shrink-0" style={{ '--p': pct } as CSSProperties}>
      <b>{pct}%</b>
    </div>
  );
}
