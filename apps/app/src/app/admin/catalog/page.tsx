import { PageHeader } from '@/components/admin/PageHeader';
import { SERVICE_CATALOG } from '@/data/services';

export default function CatalogPage() {
  const services = Object.values(SERVICE_CATALOG);
  return (
    <section>
      <PageHeader title="Catalog" subtitle="Services, packages & prices"
        actions={<button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Publish changes</button>} />
      <div className="space-y-3">
        {services.map((s) => {
          const pkgs = s.groups ? s.groups.flatMap((g) => g.packages) : (s.packages ?? []);
          return (
            <div key={s.key} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-semibold"><i className={`ph-bold ${s.icon} text-primary`} /> {s.name}</p>
                <button className="text-xs font-semibold text-primary hover:underline">Edit</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {pkgs.map((p) => (
                  <span key={p.id} className="rounded-lg border border-border px-2.5 py-1 text-xs">
                    {p.name} · <span className="font-semibold">{p.priceLabel ?? `$${p.price}`}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
