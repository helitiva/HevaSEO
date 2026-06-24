import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiTile } from '@/components/admin/KpiTile';
import { STAFF } from '@/data/adminMock';

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = STAFF.find((x) => x.id === id);
  if (!s) notFound();
  return (
    <section className="max-w-3xl">
      <PageHeader title={s.name} subtitle={`Skills: ${s.skills.join(', ')} · capacity ${s.capacity}`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon="ph-medal" label="Composite" value={String(s.composite)} tone="good" />
        <KpiTile icon="ph-seal-check" label="Quality" value={`${s.quality}%`} />
        <KpiTile icon="ph-clock" label="On-time" value={`${s.onTime}%`} />
        <KpiTile icon="ph-package" label="Throughput" value={String(s.throughput)} />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Open load</p>
        <div className="mt-2 bar"><i style={{ width: `${(s.openLoad / s.capacity) * 100}%` }} /></div>
        <p className="mt-1 text-xs text-muted-foreground">{s.openLoad} of {s.capacity} slots in use</p>
      </div>
    </section>
  );
}
