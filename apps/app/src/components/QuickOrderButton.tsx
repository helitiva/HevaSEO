'use client';

import { useRouter, usePathname } from 'next/navigation';

const DEFAULT_CLS =
  'flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:bg-primary/90 active:scale-[.98]';

/** Opens the URL-driven quick-order slide-over (service picker → form). */
export function QuickOrderButton({ label = 'New order', icon = 'ph-plus', className = DEFAULT_CLS }: { label?: string; icon?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button onClick={() => router.push(`${pathname}?neworder=pick`, { scroll: false })} className={className}>
      <i className={`ph-bold ${icon}`} /> {label}
    </button>
  );
}
