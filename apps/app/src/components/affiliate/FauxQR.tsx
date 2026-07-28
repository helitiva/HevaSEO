// A decorative QR-style mark for the Phase-0 mock. It is NOT a scannable code —
// real QR encoding lands with the backend. The module grid is seeded from the text
// so it looks stable and "belongs" to a given link. The actual shareable URL is
// always shown/copyable next to it, so nothing depends on this being scannable.
export function FauxQR({ seed, size = 116 }: { seed: string; size?: number }) {
  const n = 13; // modules per side (excluding quiet zone styling)
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bit = (i: number) => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; // xorshift
    return ((h >>> 0) + i) % 100 < 48;
  };
  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) => r >= br && r < br + 3 && c >= bc && c < bc + 3;
    return inBox(0, 0) || inBox(0, n - 3) || inBox(n - 3, 0);
  };

  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (isFinder(r, c)) continue;
      if (bit(r * n + c)) cells.push({ r, c });
    }
  }
  const u = 100 / n;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Affiliate link QR code (preview)"
      className="rounded-xl border border-border bg-white p-1.5">
      {cells.map(({ r, c }, i) => (
        <rect key={i} x={c * u + 0.6} y={r * u + 0.6} width={u - 1.2} height={u - 1.2} rx={0.8} fill="#0f172a" />
      ))}
      {[[0, 0], [0, n - 3], [n - 3, 0]].map(([r, c], i) => (
        <g key={`f${i}`}>
          <rect x={c * u + 0.4} y={r * u + 0.4} width={u * 3 - 0.8} height={u * 3 - 0.8} rx={2.4} fill="none" stroke="#0f172a" strokeWidth={1.4} />
          <rect x={(c + 1) * u + 0.4} y={(r + 1) * u + 0.4} width={u - 0.8} height={u - 0.8} rx={1} fill="#0f172a" />
        </g>
      ))}
    </svg>
  );
}
