import { slaChip, type SlaTone } from '@/lib/staff';

const TONE: Record<SlaTone, string> = {
  bad: 'pill-bad', warn: 'pill-warn', soft: 'pill-warn', neutral: 'pill',
};

// SLA countdown. Text carries the urgency (overdue/today/in Nd) so it never relies on color alone.
export function SlaChip({ daysToDue }: { daysToDue: number | null }) {
  const sla = slaChip(daysToDue);
  if (!sla) return null;
  return (
    <span className={`pill ${TONE[sla.tone]} gap-1`}>
      <i className="ph-bold ph-clock" aria-hidden /> {sla.label}
    </span>
  );
}
