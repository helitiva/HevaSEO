'use client';

import { useRouter, usePathname } from 'next/navigation';

const DEFAULT_CLS =
  'flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:bg-primary/90 active:scale-[.98]';

/** Opens the URL-driven quick-order slide-over (service picker → form).
 *  Pass `projectDomain` to preselect that project + its folder in the order form. */
export function QuickOrderButton({ label = 'New order', icon = 'ph-plus', className = DEFAULT_CLS, projectDomain }: { label?: string; icon?: string; className?: string; projectDomain?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const href = `${pathname}?neworder=pick${projectDomain ? `&project=${encodeURIComponent(projectDomain)}` : ''}`;
  return (
    <button onClick={() => router.push(href, { scroll: false })} className={className}>
      <i className={`ph-bold ${icon}`} aria-hidden /> {label}
    </button>
  );
}
