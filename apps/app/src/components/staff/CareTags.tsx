import { clientCare } from '@/data/staffMock';

// Customer care signals shown on an order: tier (rank) + a "particular" flag for demanding
// clients. The combined guidance is in the tooltip. Higher rank → handle first / carefully.
export function CareTags({ company }: { company: string }) {
  const care = clientCare(company);
  if (!care.tierMeta && !care.isDemanding) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1" title={care.hint}>
      {care.tierMeta && (
        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${care.tierMeta.color}1f`, color: care.tierMeta.color }}>
          <i className={`ph-fill ${care.tierMeta.icon}`} />{care.tierMeta.label}
        </span>
      )}
      {care.isDemanding && (
        <span className="inline-flex items-center gap-0.5 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
          <i className="ph-bold ph-seal-warning" />Particular
        </span>
      )}
    </span>
  );
}
