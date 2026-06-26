import { PageHeader } from '@/components/admin/PageHeader';
import { ADMIN_SETTINGS } from '@/data/adminMock';
import { SettingsClient } from './SettingsClient';
export default function SettingsPage() {
  return (
    <section>
      <PageHeader title="Settings" subtitle="Business, SLA, routing, email, integrations & admins" />
      <SettingsClient settings={ADMIN_SETTINGS} />
    </section>
  );
}
