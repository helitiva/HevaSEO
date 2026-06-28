import Link from 'next/link';
import type { ReactNode } from 'react';

// Shared split-screen layout for every auth page (login / register / forgot / reset). Left: a
// branded panel with atmosphere + selling points. Right: the form card. Keeps all auth surfaces
// visually consistent and on-brand (not a default centered-card template).
export function AuthShell({ title, subtitle, children, footer, aside }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      {/* brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/20 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-sm font-bold backdrop-blur">H</span>
          <span className="display text-base font-bold">HevaSEO</span>
        </Link>
        <div className="relative">{aside ?? <DefaultAside />}</div>
        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} HevaSEO. All rights reserved.</p>
      </aside>

      {/* form panel */}
      <main className="flex items-center justify-center bg-background px-5 py-10 text-foreground sm:px-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">H</span>
            <span className="display text-base font-bold">HevaSEO</span>
          </Link>
          <h1 className="display text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

function DefaultAside() {
  const points = [
    { icon: 'ph-chart-line-up', text: 'Track every order, rank, and report in one dashboard.' },
    { icon: 'ph-users-three', text: 'A team of SEO specialists working your projects.' },
    { icon: 'ph-shield-check', text: 'White-hat only. Transparent, measurable results.' },
  ];
  return (
    <div className="max-w-md">
      <p className="display text-3xl font-bold leading-tight">SEO that compounds.</p>
      <p className="mt-3 text-sm text-white/70">Sign in to your HevaSEO workspace and pick up where you left off.</p>
      <ul className="mt-8 space-y-3">
        {points.map((p) => (
          <li key={p.icon} className="flex items-start gap-3 text-sm text-white/90">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15"><i className={`ph-bold ${p.icon}`} aria-hidden /></span>
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Shared form primitives so every auth page's inputs match.
export function AuthField({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const authInputClass = 'w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary';

export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
      <i className="ph-bold ph-warning-circle" aria-hidden />{children}
    </p>
  );
}

export function AuthSubmit({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button type="submit" disabled={disabled} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </button>
  );
}
