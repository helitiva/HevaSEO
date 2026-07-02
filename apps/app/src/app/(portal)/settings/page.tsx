import { SettingsView } from '@/components/SettingsView';
import { getMyProfileAction, type ProfileForm, type BillingForm } from '@/app/(portal)/profile.actions';

export const metadata = { title: 'Settings' };

const EMPTY_PROFILE: ProfileForm = { name: '', email: '', phone: '', company: '', industry: 'E-commerce', website: '' };
const EMPTY_BILLING: BillingForm = { company: '', taxId: '', address: '' };

export default async function SettingsPage() {
  const data = await getMyProfileAction(); // RLS-scoped: the signed-in customer's own profile + billing

  return (
    <>
      <div>
        <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, security, notifications, billing, and team.</p>
      </div>
      <SettingsView initialProfile={data?.profile ?? EMPTY_PROFILE} initialBilling={data?.billing ?? EMPTY_BILLING} initialNotif={data?.notif ?? {}} />
    </>
  );
}
