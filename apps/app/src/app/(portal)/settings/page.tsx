import { SettingsView } from '@/components/SettingsView';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <>
      <div>
        <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, security, notifications, billing, and team.</p>
      </div>
      <SettingsView />
      <p className="mt-8 text-center text-xs text-muted-foreground">HevaSEO Workspace · Settings · sample data</p>
    </>
  );
}
