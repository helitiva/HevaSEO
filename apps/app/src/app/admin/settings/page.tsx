import { PageHeader } from '@/components/shared/PageHeader';
import { ADMIN_SETTINGS } from '@/data/adminMock';
import { SettingsClient } from './SettingsClient';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <section>
      <PageHeader title="Settings" subtitle="Business, SLA, routing, email, integrations & admins" />
      <SettingsClient settings={ADMIN_SETTINGS} />
    </section>
  );
}
