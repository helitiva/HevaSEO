import { PageHeader } from '@/components/admin/PageHeader';
import { SettingsTabs } from './Tabs';
export default function SettingsPage() {
  return (
    <section className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Templates, SLA, integrations, admins" />
      <SettingsTabs />
    </section>
  );
}
