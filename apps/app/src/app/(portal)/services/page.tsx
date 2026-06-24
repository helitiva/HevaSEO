import Link from 'next/link';
import { SERVICES, type ServiceKey } from '@/data/mock';
import { SERVICE_BLURBS, SERVICE_CATALOG } from '@/data/services';

export const metadata = { title: 'Services' };

export default function ServicesPage() {
  const keys = Object.keys(SERVICES) as ServiceKey[];
  return (
    <>
      <div>
        <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Order a service</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse what we do and place an order — it lands straight on your board.</p>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {keys.map((k) => {
          const s = SERVICES[k];
          const live = !!SERVICE_CATALOG[k];
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><i className={`ph-bold ${s.icon} text-xl`} /></span>
                {live ? <span className="pill pill-good">Available</span> : <span className="pill">Soon</span>}
              </div>
              <p className="mt-3 font-semibold">{s.label}</p>
              <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">{SERVICE_BLURBS[k]}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
                {live ? 'Order now' : 'Coming soon'}
                {live && <i className="ph-bold ph-arrow-right transition group-hover:translate-x-0.5" />}
              </span>
            </>
          );
          return live ? (
            <Link key={k} href={`/services/${k}`} className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              {inner}
            </Link>
          ) : (
            <div key={k} className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 opacity-70">
              {inner}
            </div>
          );
        })}
      </section>
    </>
  );
}
