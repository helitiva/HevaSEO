'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut, type AuthRole } from '@/lib/auth';

const ROLE_LABEL: Record<AuthRole, string> = {
  customer: 'Customer', staff: 'Staff', manager: 'Manager', admin: 'Admin', affiliate: 'Affiliate',
};

// Avatar button + dropdown shared by every portal topbar. Shows who's signed in (from the mock
// session) and a Sign out action that clears the session and returns to /login — so you can flip
// between accounts to test register/login. If no session exists (portals are openable directly in
// the demo), it offers Sign in instead.
export function AccountMenu({ initials, accentClass, title, avatarUrl }: { initials: string; accentClass?: string; title?: string; avatarUrl?: string }) {
  const router = useRouter();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const accent = accentClass ?? 'bg-gradient-to-br from-brand-500 to-brand-700';
  const logout = () => { signOut(); setOpen(false); router.push('/login'); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`grid h-10 w-10 place-items-center overflow-hidden rounded-lg text-sm font-bold text-white shadow-md outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary ${avatarUrl ? 'bg-muted' : accent}`}
      >
        {avatarUrl
          // eslint-disable-next-line @next/next/no-img-element -- user Storage URL, dynamic host
          ? <img src={avatarUrl} alt="Account" className="h-full w-full object-cover" />
          : initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold">{session?.name ?? 'Guest'}</p>
            <p className="truncate text-xs text-muted-foreground">{session?.email ?? 'Not signed in'}</p>
            {session && <span className="mt-1.5 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{ROLE_LABEL[session.role]}</span>}
          </div>
          {session ? (
            <button onClick={logout} role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10">
              <i className="ph-bold ph-sign-out" aria-hidden /> Sign out
            </button>
          ) : (
            <button onClick={() => { setOpen(false); router.push('/login'); }} role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium transition hover:bg-accent">
              <i className="ph-bold ph-sign-in" aria-hidden /> Sign in
            </button>
          )}
        </div>
      )}
    </div>
  );
}
