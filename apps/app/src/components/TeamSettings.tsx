'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { useToast } from './Toast';

type Role = 'Owner' | 'Admin' | 'Member';
type Member = { id: string; name: string; email: string; initials: string; role: Role };

const SEED: Member[] = [
  { id: 'm1', name: 'Huy Nguyen (you)', email: 'huy@hevashop.com', initials: 'HV', role: 'Owner' },
  { id: 'm2', name: 'Olivia Chen', email: 'olivia@hevaseo.com', initials: 'OC', role: 'Admin' },
  { id: 'm3', name: 'Marcus Tran', email: 'marcus@hevashop.com', initials: 'MT', role: 'Member' },
];

const initialsOf = (email: string) => {
  const p = email.replace(/@.*/, '').split(/[.\s_-]+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || email.slice(0, 2).toUpperCase();
};

function RolePill({ role }: { role: Role }) {
  if (role === 'Owner') return <span className="pill" style={{ background: '#f59e0b1f', color: '#d97706' }}>Owner</span>;
  if (role === 'Admin') return <span className="pill pill-good">Admin</span>;
  return <span className="pill" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>Member</span>;
}

const fieldCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

export function TeamSettings() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>(SEED);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('Member');

  const invite = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    if (!email) return;
    setMembers((m) => [...m, { id: `m${Date.now()}`, name: email.replace(/@.*/, ''), email, initials: initialsOf(email), role }]);
    toast(`Invite sent to ${email}`);
    setInviteOpen(false);
    setRole('Member');
  };
  const toggleRole = (id: string) => { setMembers((m) => m.map((x) => x.id === id ? { ...x, role: x.role === 'Admin' ? 'Member' : 'Admin' } : x)); setMenuFor(null); toast('Role updated'); };
  const removeMember = (id: string) => { const mm = members.find((x) => x.id === id); setMembers((m) => m.filter((x) => x.id !== id)); setMenuFor(null); toast(`${mm?.name ?? 'Member'} removed`, 'info'); };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="display text-lg font-semibold tracking-tight">Team</h2><p className="text-xs text-muted-foreground">Invite teammates to help manage projects &amp; orders.</p></div>
        <button onClick={() => setInviteOpen(true)} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]"><i className="ph-bold ph-user-plus" /> Invite member</button>
      </div>

      <div className="mt-5 space-y-2.5">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
            <span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${m.role === 'Owner' ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white' : 'bg-secondary text-secondary-foreground'}`}>{m.initials}</span>
            <div className="min-w-0 flex-1 text-sm"><p className="truncate font-medium">{m.name}</p><p className="truncate text-[11px] text-muted-foreground">{m.email}</p></div>
            <RolePill role={m.role} />
            {m.role !== 'Owner' && (
              <span className="relative">
                <button onClick={() => setMenuFor((v) => (v === m.id ? null : m.id))} aria-label="Member options" className="text-muted-foreground transition hover:text-foreground"><i className="ph-bold ph-dots-three-vertical" /></button>
                {menuFor === m.id && (
                  <>
                    <span className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
                    <span className="absolute right-0 z-50 mt-1 block w-44 rounded-xl border border-border bg-card p-1 shadow-xl">
                      <button onClick={() => toggleRole(m.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-muted"><i className="ph-bold ph-shield-check text-muted-foreground" /> Make {m.role === 'Admin' ? 'Member' : 'Admin'}</button>
                      <button onClick={() => removeMember(m.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive transition hover:bg-destructive/10"><i className="ph-bold ph-user-minus" /> Remove</button>
                    </span>
                  </>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">The Agency plan supports multiple sub-accounts &amp; per-project permissions.</p>

      {inviteOpen && (
        <Modal onClose={() => setInviteOpen(false)} title="Invite member" subtitle="They'll get an email to join your workspace" icon="ph-user-plus">
          {({ close }) => (
            <form onSubmit={invite} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Email<span className="text-primary"> *</span></label>
                <input name="email" type="email" required autoFocus placeholder="teammate@company.com" className={fieldCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${fieldCls} appearance-none`}>
                  <option value="Admin">Admin — manage projects, orders &amp; billing</option>
                  <option value="Member">Member — manage projects &amp; orders</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={close} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-paper-plane-tilt" /> Send invite</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </section>
  );
}
