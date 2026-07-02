import { SettingsView } from '@/components/SettingsView';
import { getMyProfileAction, type ProfileForm, type BillingForm } from '@/app/(portal)/profile.actions';
import { getMySettingsAction, type MySettings } from '@/app/(portal)/settings.actions';

export const metadata = { title: 'Settings' };

const EMPTY_PROFILE: ProfileForm = { name: '', email: '', phone: '', company: '', industry: 'E-commerce', website: '' };
const EMPTY_BILLING: BillingForm = { company: '', taxId: '', address: '' };
const EMPTY_SETTINGS: MySettings = {
  twoFactor: false, autoTopup: { enabled: false, threshold: 40, amount: 199 },
  locale: 'English', timezone: '(GMT-8) Los Angeles', plan: 'new', apiKeys: [], webhook: null, paymentMethods: [],
};

export default async function SettingsPage() {
  // RLS-scoped: the signed-in customer's own profile/billing + the rest of their settings.
  const [data, settings] = await Promise.all([getMyProfileAction(), getMySettingsAction()]);

  return (
    <>
      <div>
        <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, security, notifications, billing, and team.</p>
      </div>
      <SettingsView
        initialProfile={data?.profile ?? EMPTY_PROFILE}
        initialBilling={data?.billing ?? EMPTY_BILLING}
        initialNotif={data?.notif ?? {}}
        initialSettings={settings ?? EMPTY_SETTINGS}
      />
    </>
  );
}
