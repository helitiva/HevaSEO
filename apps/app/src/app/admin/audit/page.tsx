import { AuditView } from './AuditView';
import { getAuditEntries } from '@/data/adminAudit.server';

export const metadata = { title: 'Audit log' };

/**
 * Real audit_log. It used to render adminMock's AUDIT — 24 rows frozen on 2026-06-24 — while the
 * Command Center right beside it showed the real feed. Same tenant, same question: one page said June,
 * the other July.
 *
 * /manager/audit deliberately keeps the mock. audit_log's RLS is admin-only BY DESIGN (see
 * 20260629050001_audit.sql — "Manager pod-scoped, money-stripped audit is deferred") because the log
 * carries staff.comp_set, payroll.run and commission.posted: exactly the money the manager surface is
 * built to be blind to. A manager calling this would read zero rows anyway. Widening that policy needs
 * a column-filtered view or a pod-scoped policy — a security decision, not a role added to the `using`.
 */
export default async function AuditPage() {
  const events = await getAuditEntries();
  return <AuditView source={events} isReal />;
}
