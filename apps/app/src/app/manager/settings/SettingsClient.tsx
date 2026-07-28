'use client';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface ManagerProfile { name: string; email: string; title: string; rank: string; podSize: number }

// Manager personal settings — deliberately NOT the org-wide admin settings
// (business/SLA/routing/integrations/admins live in /admin and need org.settings).
// A manager configures only their own profile and notification preferences.
export function ManagerSettingsClient({ profile }: { profile: ManagerProfile }) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [notif, setNotif] = useState({ overdue: true, review: true, tickets: true, leave: false });
  const [toast, setToast] = useState<string | null>(null);
  const save = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="space-y-4 lg:col-span-2">
        <Card icon="ph-user-circle" title="Profile">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></Field>
            <Field label="Work email"><input value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></Field>
            <Field label="Title"><input value={profile.title} disabled className={`${input} opacity-60`} /></Field>
            <Field label="Rank"><input value={profile.rank} disabled className={`${input} opacity-60`} /></Field>
          </div>
          <button onClick={() => save('Profile saved')} className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Save profile</button>
        </Card>

        <Card icon="ph-bell" title="Notifications" right={<span className="text-xs text-muted-foreground">scoped to your pod</span>}>
          <div className="space-y-1">
            <Toggle label="Overdue order alerts" on={notif.overdue} onClick={() => { setNotif((n) => ({ ...n, overdue: !n.overdue })); save('Saved'); }} />
            <Toggle label="Deliverables awaiting review" on={notif.review} onClick={() => { setNotif((n) => ({ ...n, review: !n.review })); save('Saved'); }} />
            <Toggle label="New / breached tickets" on={notif.tickets} onClick={() => { setNotif((n) => ({ ...n, tickets: !n.tickets })); save('Saved'); }} />
            <Toggle label="Team leave requests" on={notif.leave} onClick={() => { setNotif((n) => ({ ...n, leave: !n.leave })); save('Saved'); }} />
          </div>
        </Card>
      </section>

      <aside className="space-y-4">
        <Card icon="ph-users-three" title="Your pod">
          <p className="text-sm text-muted-foreground">You manage <b className="text-foreground">{profile.podSize}</b> people. Pod membership and pay are configured by an admin.</p>
        </Card>
        <Card icon="ph-paint-brush" title="Appearance">
          <div className="flex items-center justify-between"><span className="text-sm">Theme</span><ThemeToggle /></div>
        </Card>
        <Card icon="ph-lock-simple" title="Not available">
          <p className="text-sm text-muted-foreground">Org settings, finance, analytics and managing other managers are admin-only and not shown here.</p>
        </Card>
      </aside>

      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl"><i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" aria-hidden />{toast}</div>}
    </div>
  );
}

const input = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>;
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><i className={`ph-bold ${icon} text-primary`} aria-hidden />{title}</h2>{right}</div>
      {children}
    </div>
  );
}
function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm transition hover:bg-muted">
      <span>{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${on ? 'left-4' : 'left-0.5'}`} /></span>
    </button>
  );
}
