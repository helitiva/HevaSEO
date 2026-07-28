'use client';
import Link from 'next/link';
import { useSiteAlerts, markBroadcastClicked } from '@/data/broadcastStore';
import { useBroadcastAudience } from '@/lib/broadcastAudience';
import { KIND_META } from '@/data/broadcasts';

// A thin site-wide bar under the topbar for CRITICAL broadcasts (maintenance / outage) — shown
// on EVERY page for the audience, not just the overview, so a system issue is always visible.
// requireAck messages must be acknowledged (no quick dismiss).
export function SiteAlertBar() {
  const aud = useBroadcastAudience();
  const { alerts, dismiss, acknowledge } = useSiteAlerts(aud);
  if (alerts.length === 0) return null;
  const b = alerts[0]; // top (pinned/newest) — the rest queue behind it
  const m = KIND_META[b.kind];

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2 text-sm lg:px-7" style={{ backgroundColor: `${m.color}1a`, borderColor: `${m.color}55` }}>
      <i className={`ph-fill ${m.icon} shrink-0`} style={{ color: m.color }} aria-hidden />
      <span className="min-w-0 flex-1 truncate"><b className="font-semibold">{b.title}</b> <span className="text-muted-foreground">· {b.body}</span></span>
      {b.cta && <Link href={b.cta.href} onClick={() => markBroadcastClicked(aud, b.id)} className="shrink-0 font-semibold underline underline-offset-2" style={{ color: m.color }}>{b.cta.label}</Link>}
      {alerts.length > 1 && <span className="shrink-0 rounded-full bg-background/60 px-1.5 text-[10px] font-bold text-muted-foreground">+{alerts.length - 1}</span>}
      {b.requireAck
        ? <button onClick={() => acknowledge(b.id)} className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90" style={{ background: m.color }}>Acknowledge</button>
        : <button onClick={() => dismiss(b.id)} aria-label="Dismiss alert" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-background/60"><i className="ph-bold ph-x" aria-hidden /></button>}
    </div>
  );
}
