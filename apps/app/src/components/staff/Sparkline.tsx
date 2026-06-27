// Small inline trend chart on compositor-friendly SVG. Theme-driven stroke via --primary.
export function Sparkline({ data, w = 520, h = 96 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (w - 8) + 4;
  const y = (v: number) => h - 10 - ((v - min) / range) * (h - 24);
  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const fill = `${x(0)},${h - 4} ${line} ${x(data.length - 1)},${h - 4}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" height={h} aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill="url(#spark-fill)" />
      <polyline points={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === data.length - 1 ? 3.5 : 2} fill="hsl(var(--primary))" />
      ))}
    </svg>
  );
}
