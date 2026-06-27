import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsClient } from './SettingsClient';
import { STAFF, SKILL_META } from '@/data/adminMock';
import { CURRENT_STAFF, MY_AVAILABILITY } from '@/data/staffMock';
import { currentStaffId } from '@/lib/currentStaff';

export default async function SettingsPage() {
  const sid = await currentStaffId();
  const s = STAFF.find((x) => x.id === sid);

  const profile = {
    name: s?.name ?? CURRENT_STAFF.name,
    role: s?.role ?? CURRENT_STAFF.role,
    email: s?.email ?? '—',
    tz: s?.tz ?? '—',
    since: s?.since ?? '—',
  };
  const skills = (s?.skills ?? []).map((k) => ({ key: k, ...SKILL_META[k] }));

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle="Your profile, availability and preferences" />
      <SettingsClient
        profile={profile}
        skills={skills}
        hours={MY_AVAILABILITY.hours}
        seededLeave={MY_AVAILABILITY.timeOff}
      />
    </section>
  );
}
