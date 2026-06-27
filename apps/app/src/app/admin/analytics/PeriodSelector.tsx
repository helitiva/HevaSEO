'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const PERIODS = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '1y', label: '1y' },
] as const;

export function PeriodSelector() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const current = searchParams.get('period') ?? '30d';

  const set = useCallback(
    (p: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('period', p);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-background/60 p-1">
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => set(key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            current === key
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
