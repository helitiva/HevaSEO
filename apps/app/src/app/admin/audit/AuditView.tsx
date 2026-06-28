import { AUDIT_CATEGORY, AUDIT_ENTITY, type AuditEntity, type AuditEntry } from '@/data/adminMock';
import { AuditClient } from './AuditClient';
import { MOCK_TODAY } from '@/lib/today';

const TODAY = MOCK_TODAY;

// Shared by the admin Audit page and the manager (pod-scoped) one. KPIs recompute
// from whatever slice of events is passed in.
export function AuditView({ source }: { source: readonly AuditEntry[] }) {
  const events = [...source].sort((a, b) => b.at.localeCompare(a.at));

  const entityCounts = events.reduce<Record<string, number>>((acc, e) => { acc[e.entity] = (acc[e.entity] ?? 0) + 1; return acc; }, {});
  const topEntity = (Object.entries(entityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'order') as AuditEntity;
  const kpis = {
    total: events.length,
    today: events.filter((e) => e.at.startsWith(TODAY)).length,
    actors: new Set(events.map((e) => e.actor)).size,
    destructive: events.filter((e) => e.category === 'destructive').length,
    topEntity: AUDIT_ENTITY[topEntity].label,
  };

  return <AuditClient events={events} categoryMeta={AUDIT_CATEGORY} entityMeta={AUDIT_ENTITY} kpis={kpis} />;
}
