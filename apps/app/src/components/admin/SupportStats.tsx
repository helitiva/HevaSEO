import Link from 'next/link';
import { Donut } from './Donut';
import { TICKET_STATS } from '@/data/adminMock';

export function SupportStats() {
  const t = TICKET_STATS;
  const segs = [
    { label: 'Open', value: t.open, color: '#f59e0b' },
    { label: 'Pending', value: t.pending, color: '#a78bfa' },
    { label: 'Resolved', value: t.resolved, color: '#10b981' },
    { label: 'Closed', value: t.closed, color: '#94a3b8' },
  ];
  const total = segs.reduce((s, x) => s + x.value, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-lifebuoy text-primary" aria-hidden /> Support</p>
        <Link href="/admin/tickets" className="text-xs font-semibold text-primary hover:underline">Inbox →</Link>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <Donut segs={segs} centerValue={String(total)} centerLabel="tickets" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat icon="ph-chat-circle-dots" label="Answered today" value={String(t.answeredToday)} />
            <Stat icon="ph-timer" label="Avg 1st response" value={`${t.avgFirstResponseH}h`} />
          </div>
          <div className="space-y-1.5">
            {segs.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5"><span className="legend-dot" style={{ background: s.color }} />{s.label}</span>
                <span className="font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-2.5">
      <i className={`ph-bold ${icon} text-primary`} aria-hidden />
      <p className="display mt-0.5 text-lg font-bold leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
