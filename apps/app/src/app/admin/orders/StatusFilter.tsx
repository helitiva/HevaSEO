'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { statusLabel, type OrderStatus } from '@/data/adminMock';

const SHOWN: OrderStatus[] = ['new','confirmed','assigned','in_progress','internal_review','delivered','approved','completed'];

export function StatusFilter({ counts }: { counts: Partial<Record<OrderStatus, number>> }) {
  const active = useSearchParams().get('status');
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/admin/orders" className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${!active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>All</Link>
      {SHOWN.map((s) => (
        <Link key={s} href={`/admin/orders?status=${s}`} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${active === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>
          {statusLabel[s]} <span className="opacity-70">{counts[s] ?? 0}</span>
        </Link>
      ))}
    </div>
  );
}
