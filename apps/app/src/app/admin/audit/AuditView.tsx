import { AUDIT_CATEGORY, AUDIT_ENTITY, type AuditEntity, type AuditEntry } from '@/data/adminMock';
import { AuditClient } from './AuditClient';
import { MOCK_TODAY } from '@/lib/today';

/**
 * Shared by the admin Audit page (REAL audit_log) and the manager pod-scoped one (still mock — the log
 * is admin-only by RLS design).
 *
 * `isReal` picks the clock and gates the controls; it isn't cosmetic. Mock events are dated 2026-06-24
 * and real ones are dated now, so a single hardcoded TODAY is wrong for one of the two callers whichever
 * you pick — "Events today" read 0 and the relative times went negative ("just now" on everything).
 */
export function AuditView({ source, isReal = false }: { source: readonly AuditEntry[]; isReal?: boolean }) {
  const events = [...source].sort((a, b) => b.at.localeCompare(a.at));
  // real rows are stamped UTC (getAuditEntries slices the ISO string), so "today" is UTC too
  const today = isReal ? new Date().toISOString().slice(0, 10) : MOCK_TODAY;

  const entityCounts = events.reduce<Record<string, number>>((acc, e) => { acc[e.entity] = (acc[e.entity] ?? 0) + 1; return acc; }, {});
  const topEntity = (Object.entries(entityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'order') as AuditEntity;
  const kpis = {
    total: events.length,
    today: events.filter((e) => e.at.startsWith(today)).length,
    actors: new Set(events.map((e) => e.actor)).size,
    destructive: events.filter((e) => e.category === 'destructive').length,
    topEntity: AUDIT_ENTITY[topEntity].label,
  };

  return <AuditClient events={events} categoryMeta={AUDIT_CATEGORY} entityMeta={AUDIT_ENTITY} kpis={kpis} today={today} isReal={isReal} />;
}
