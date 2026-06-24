export interface DonutSeg { label: string; value: number; color: string; }

export function Donut({ segs, size = 132, thickness = 15, centerValue, centerLabel }: {
  segs: DonutSeg[]; size?: number; thickness?: number; centerValue: string; centerLabel: string;
}) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={thickness} />
        {segs.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * C;
          const off = -acc * C;
          acc += frac;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${dash.toFixed(2)} ${(C - dash).toFixed(2)}`} strokeDashoffset={off.toFixed(2)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="display text-lg font-bold leading-none">{centerValue}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}
