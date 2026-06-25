import { AUDIT, AUDIT_CATEGORY, AUDIT_ENTITY, type AuditEntity } from '@/data/adminMock';
import { AuditClient } from './AuditClient';

const TODAY = '2026-06-24';

export default function AuditPage() {
  const events = [...AUDIT].sort((a, b) => b.at.localeCompare(a.at));

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
