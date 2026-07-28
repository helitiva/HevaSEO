import Link from 'next/link';
import type { ReactNode } from 'react';

// Shared split-screen layout for every auth page (login / register / forgot / reset). Left: a
// branded panel with atmosphere + selling points. Right: a scrollable form column.
//
// NOTE: globals.css sets `html, body { overflow: hidden }`, so auth pages can't rely on body
// scroll — the form column owns its own scroll (`overflow-y-auto`) and the inner block uses
// `m-auto` so it centers when short and scrolls cleanly when tall (long forms aren't clipped).
export function AuthShell({ title, subtitle, children, footer, aside }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="grid h-[100dvh] overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
        <div className="pointer-events-none absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-black/25 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-base font-bold backdrop-blur">H</span>
          <span className="display text-lg font-bold">HevaSEO</span>
        </Link>
        <div className="relative">{aside ?? <DefaultAside />}</div>
        <p className="relative text-xs text-white/55">© {new Date().getFullYear()} HevaSEO. All rights reserved.</p>
      </aside>

      {/* form column (owns its own scroll; min-h-full + justify-center centers short forms and
          lets tall ones flow top-down without clipping the first field) */}
      <main className="relative overflow-y-auto bg-background text-foreground">
        <div className="flex min-h-full flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white">H</span>
            <span className="display text-lg font-bold">HevaSEO</span>
          </Link>
          <h1 className="display text-[1.75rem] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-7 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
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
      <p className="display text-[2.5rem] font-bold leading-[1.05]">SEO that<br />compounds.</p>
      <p className="mt-4 text-sm leading-relaxed text-white/70">Sign in to your HevaSEO workspace and pick up right where you left off.</p>
      <ul className="mt-9 space-y-4">
        {points.map((p) => (
          <li key={p.icon} className="flex items-start gap-3 text-sm text-white/90">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 ring-1 ring-white/10"><i className={`ph-bold ${p.icon} text-base`} aria-hidden /></span>
            <span className="pt-1">{p.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-10 max-w-sm rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
        <div className="flex gap-0.5 text-amber-300" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => <i key={i} className="ph-fill ph-star text-sm" />)}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/85">“Our organic traffic doubled in two quarters. The dashboard makes it effortless to see what's working.”</p>
        <p className="mt-2 text-xs font-semibold text-white/60">— Elena Park, Orbit Labs</p>
      </div>
    </div>
  );
}

// ── Shared form primitives (used by every auth page so inputs match) ──────────────
export function AuthField({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-foreground/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const authInputClass = 'w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/60 hover:border-border/70 focus:border-primary focus:ring-2 focus:ring-primary/25';

export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="flex items-start gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">
      <i className="ph-bold ph-warning-circle mt-px shrink-0 text-sm" aria-hidden />{children}
    </p>
  );
}

export function AuthSubmit({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition enabled:hover:from-brand-500 enabled:hover:to-brand-600 enabled:hover:shadow-brand-600/40 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
    >
      {children}
    </button>
  );
}
