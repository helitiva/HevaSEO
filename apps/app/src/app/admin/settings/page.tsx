import { PageHeader } from '@/components/shared/PageHeader';
import { ADMIN_SETTINGS } from '@/data/adminMock';
import { SettingsClient } from './SettingsClient';

export const metadata = { title: 'Settings' };

/**
 * NOT WIRED UP — and it now says so on the page.
 *
 * Every tab reads ADMIN_SETTINGS (an adminMock constant that nothing else in the app imports) and every
 * edit is discarded on refresh. Until this pass it also claimed the opposite: saving toasted "Settings
 * saved · change logged to the audit log" — nothing was saved, and audit_log has no settings.* verb at
 * all. Deactivating an admin greyed a row and left the account live.
 *
 * The banner stays until the tabs are real. Why it isn't a quick fix: SLA, Routing/scoring and Email
 * have no table AND no reader — nothing in the assignment engine or the SLA timers consults any config,
 * so persisting these would still change nothing about how the product behaves. General (tenants) and
 * Admins (profiles already has status/role/two_fa_enabled) are the two that could be made real first.
 */
export default function SettingsPage() {
  return (
    <section>
      <PageHeader title="Settings" subtitle="Business, SLA, routing, email, integrations & admins" />
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3.5 py-2.5">
        <i className="ph-bold ph-flask mt-0.5 shrink-0 text-amber-600" aria-hidden />
        <p className="text-xs text-amber-800 dark:text-amber-500">
          <b>Preview — nothing here is saved yet.</b> These tabs aren&apos;t connected to the backend: edits last until you
          reload, and none of them affect how orders are routed, how SLAs are timed, or what emails go out.
          Real settings live where the feature does — pricing in <b>Catalog</b>, pay in <b>Finance › Payouts</b>.
        </p>
      </div>
      <SettingsClient settings={ADMIN_SETTINGS} />
    </section>
  );
}
