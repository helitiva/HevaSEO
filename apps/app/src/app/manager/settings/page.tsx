import { PageHeader } from '@/components/shared/PageHeader';
import { ManagerSettingsClient } from './SettingsClient';
import { managerScope, MANAGER_PERSONA } from '@/lib/managerScope';

export default function ManagerSettingsPage() {
  const scope = managerScope(MANAGER_PERSONA);
  const m = scope.manager;
  const profile = {
    name: m?.name ?? 'Manager',
    email: m?.email ?? '',
    title: m?.title ?? 'Manager',
    rank: m?.rank ?? '',
    podSize: scope.staff.length,
  };
  return (
    <section>
      <PageHeader title="Settings" subtitle="Your profile & notification preferences" />
      <ManagerSettingsClient profile={profile} />
    </section>
  );
}
