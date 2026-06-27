'use client';

import { useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { GEO } from '@/data/adminMock';

const GEO_URL = '/world-50m.json';

const geoByIso = Object.fromEntries(GEO.map((g) => [g.isoNum, g]));
const maxUsers = Math.max(...GEO.map((g) => g.users));
const total = GEO.reduce((s, g) => s + g.users, 0);
const sorted = [...GEO].sort((a, b) => b.users - a.users);

interface Tooltip { name: string; flag: string; users: number; pct: number; }

export function GeoPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <i className="ph-bold ph-globe-hemisphere-west text-primary" /> Visitors by location
        </p>
        <p className="text-xs text-muted-foreground">
          via IP ·{' '}
          <span className="font-semibold text-foreground">{GEO.length}</span> countries ·{' '}
          <span className="font-semibold text-foreground">{total.toLocaleString('en-US')}</span> visitors
        </p>
      </div>

      <div className="grid items-start gap-5 sm:grid-cols-[1.6fr_1fr]">
        {/* choropleth map */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl border border-border bg-background/40"
          onMouseMove={(e) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <ComposableMap
            projection="geoNaturalEarth1"
            projectionConfig={{ scale: 145, center: [10, 10] }}
            style={{ width: '100%', height: 'auto' }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const row = geoByIso[String(geo.id)];
                  const ratio = row ? row.users / maxUsers : 0;
                  const opacity = row ? 0.18 + ratio * 0.82 : 1;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={row ? `hsl(var(--primary) / ${opacity.toFixed(2)})` : 'hsl(var(--muted))'}
                      stroke="hsl(var(--border))"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: 'none' },
                        hover: {
                          outline: 'none',
                          fill: row
                            ? `hsl(var(--primary) / ${Math.min(1, opacity + 0.15).toFixed(2)})`
                            : 'hsl(var(--accent))',
                          cursor: row ? 'pointer' : 'default',
                        },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={() => {
                        if (!row) return;
                        setTooltip({
                          name: row.country,
                          flag: row.flag,
                          users: row.users,
                          pct: Math.round((row.users / total) * 100),
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {/* hover tooltip */}
          {tooltip && (
            <div
              className="pointer-events-none absolute z-10 min-w-[10rem] rounded-xl border border-border bg-card px-3 py-2 shadow-xl"
              style={{
                left: Math.min(mousePos.x + 12, (containerRef.current?.clientWidth ?? 300) - 180),
                top: Math.max(8, mousePos.y - 52),
              }}
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-base leading-none">{tooltip.flag}</span>
                {tooltip.name}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {tooltip.users.toLocaleString('en-US')} visitors ·{' '}
                <b className="text-foreground">{tooltip.pct}%</b> of total
              </p>
            </div>
          )}
        </div>

        {/* ranked country list — all countries */}
        <div className="space-y-2.5">
          {sorted.map((g, i) => {
            const pct = Math.round((g.users / total) * 100);
            return (
              <div key={g.country}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-base leading-none">{g.flag}</span>
                    <span className="truncate">{g.country}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {g.users.toLocaleString('en-US')} ·{' '}
                    <b className="text-foreground">{pct}%</b>
                  </span>
                </div>
                <div className="ml-5 mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(g.users / maxUsers) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
