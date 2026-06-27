import Link from 'next/link';
import { getCatalog } from '@/data/services';
import { SERVICES, type ServiceKey } from '@/data/mock';
import { ServiceOrder } from '@/components/ServiceOrder';

export async function generateMetadata({ params }: { params: Promise<{ svc: string }> }) {
  const { svc } = await params;
  const cat = getCatalog(svc);
  const svcMeta = SERVICES[svc as ServiceKey];
  return { title: cat ? `Order ${cat.name}` : svcMeta ? svcMeta.label : 'Service' };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ svc: string }> }) {
  const { svc } = await params;
  const catalog = getCatalog(svc);
  const svcMeta = SERVICES[svc as ServiceKey];

  // Crumb shared by both states.
  const crumb = (
    <nav className="text-xs text-muted-foreground">
      <Link href="/services" className="crumb-link hover:text-foreground">Services</Link>
      <span className="px-1.5">/</span>
      <span className="font-medium text-foreground">{catalog?.name ?? svcMeta?.label ?? 'Service'}</span>
    </nav>
  );

  if (!catalog) {
    return (
      <>
        {crumb}
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary"><i className={`ph-bold ${svcMeta?.icon ?? 'ph-package'} text-2xl`} /></span>
          <h1 className="display mt-5 text-xl font-semibold tracking-tight">{svcMeta?.label ?? 'This service'} is coming to your dashboard</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Self-serve ordering for this service is on the way. In the meantime, your specialist can set it up for you.</p>
          <div className="mt-6 flex gap-2">
            <Link href="/services" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:bg-accent">Back to services</Link>
            <Link href="/support" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">Ask an advisor</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {crumb}

      {/* header */}
      <div className="mt-4 flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-brand-500/25"><i className={`ph-bold ${catalog.icon} text-2xl`} /></span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Order a service</p>
          <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">{catalog.name}</h1>
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{catalog.hero}</p>

      {/* what's included + how it works */}
      <section className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">What&apos;s included</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {catalog.included.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><i className={`ph-bold ${b.icon}`} /></span>
                <div>
                  <p className="text-sm font-semibold leading-tight">{b.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">How it works</p>
          <ol className="mt-4 space-y-3">
            {catalog.steps.map((b, i) => (
              <li key={b.title} className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight">{b.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{b.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* order */}
      <section className="mt-6">
        <h2 className="display text-lg font-semibold tracking-tight">Place your order</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick a plan and tell us about the project — it lands on your board as a new order.</p>
        <div className="mt-4">
          <ServiceOrder catalog={catalog} />
        </div>
      </section>

      {/* faqs */}
      {catalog.faqs && catalog.faqs.length > 0 && (
        <section className="mt-8">
          <h2 className="display text-lg font-semibold tracking-tight">FAQ</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.faqs.map((f) => (
              <div key={f.q} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">{f.q}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
