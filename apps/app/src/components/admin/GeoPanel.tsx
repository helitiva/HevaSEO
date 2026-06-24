import { GEO } from '@/data/adminMock';

export function GeoPanel() {
  const total = GEO.reduce((s, g) => s + g.users, 0);
  const max = Math.max(...GEO.map((g) => g.users));
  const rows = [...GEO].sort((a, b) => b.users - a.users);
  const W = 200, H = 112;
  const grid = [0.2, 0.4, 0.6, 0.8];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-globe-hemisphere-west text-primary" /> Visitors by location</p>
        <p className="text-xs text-muted-foreground">via IP · <span className="font-semibold text-foreground">{GEO.length}</span> countries</p>
      </div>

      <div className="grid items-center gap-5 sm:grid-cols-[1.2fr_1fr]">
        {/* bubble map */}
        <div className="overflow-hidden rounded-xl border border-border bg-background/40">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="World distribution of visitors">
            {grid.map((g) => <line key={`h${g}`} x1={0} x2={W} y1={g * H} y2={g * H} stroke="hsl(var(--border))" strokeOpacity={0.4} strokeDasharray="2 4" />)}
            {grid.map((g) => <line key={`v${g}`} x1={g * W} x2={g * W} y1={0} y2={H} stroke="hsl(var(--border))" strokeOpacity={0.4} strokeDasharray="2 4" />)}
            {rows.map((g) => (
              <g key={g.country}>
                <circle cx={g.x * W} cy={g.y * H} r={5 + (g.users / max) * 11} fill="hsl(var(--primary))" fillOpacity={0.18} />
                <circle cx={g.x * W} cy={g.y * H} r={3} fill="hsl(var(--primary))" />
                <text x={g.x * W} y={g.y * H - (6 + (g.users / max) * 11)} textAnchor="middle" fontSize="9">{g.flag}</text>
              </g>
            ))}
          </svg>
        </div>

        {/* country list */}
        <div className="space-y-2">
          {rows.slice(0, 6).map((g) => {
            const pct = Math.round((g.users / total) * 100);
            return (
              <div key={g.country}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium"><span>{g.flag}</span>{g.country}</span>
                  <span className="text-muted-foreground">{g.users.toLocaleString('en-US')} · <b className="text-foreground">{pct}%</b></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(g.users / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
