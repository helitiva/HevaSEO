'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { resolveAddOns, type AddOn, type AddOnTier } from '@heva/catalog';
import { BulkKeywordList } from './BulkKeywordList';
import { UsageLinkList } from './UsageLinkList';
import { useOrdersStore } from './OrdersStore';
import { useToast } from './Toast';
import type { Order } from '@/data/mock';
import type { SvcCatalog, SvcField, SvcPackage } from '@/data/services';

type ProjectOption = { name: string; domain: string };

function field(f: SvcField) {
  const base =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20';
  const span = f.colSpan === 2 ? 'sm:col-span-2' : '';

  // Per-article keyword rows (keyword + internal-link + reference URL), one row per article.
  if (f.as === 'keyword-rows') {
    const n = f.rows ?? 3;
    return (
      <div key={f.name} className={`flex flex-col gap-1.5 ${span}`}>
        <label className="text-xs font-semibold">
          {f.label}<span className="ml-1 font-normal text-muted-foreground">({n} {n === 1 ? 'article' : 'articles'})</span>
        </label>
        <div className="hidden gap-2 px-1 text-[10px] font-medium text-muted-foreground sm:grid sm:grid-cols-[1.2fr_1fr_1fr]">
          <span>Keyword(s) for the article</span>
          <span>Internal link URL · optional</span>
          <span>Reference URL · optional</span>
        </div>
        <div className="space-y-2">
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1fr]">
              <input name={`${f.name}_keyword`} placeholder="best running shoes for flat feet" className={base} />
              <input name={`${f.name}_internal`} placeholder="/related-page" className={base} />
              <input name={`${f.name}_reference`} type="url" placeholder="https://ref.com/article" className={base} />
            </div>
          ))}
        </div>
        {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
      </div>
    );
  }

  const control =
    f.as === 'textarea' ? (
      <textarea name={f.name} rows={3} required={f.required} placeholder={f.placeholder} className={`${base} resize-y leading-relaxed`} />
    ) : f.as === 'select' ? (
      <select name={f.name} required={f.required} className={`${base} appearance-none`}>
        {(f.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : (
      <input name={f.name} type={f.type ?? 'text'} required={f.required} placeholder={f.placeholder} className={base} />
    );
  return (
    <div key={f.name} className={`flex flex-col gap-1.5 ${span}`}>
      <label className="text-xs font-semibold">
        {f.label}
        {f.required ? <span className="text-primary"> *</span> : <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {control}
      {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
    </div>
  );
}

function todayUS(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
}

export function ServiceOrder({ catalog, projects }: { catalog: SvcCatalog; projects: ProjectOption[] }) {
  const router = useRouter();
  const { addOrder } = useOrdersStore();
  const toast = useToast();

  const isUsage = !!catalog.usage;
  const allPackages = catalog.groups ? catalog.groups.flatMap((g) => g.packages) : (catalog.packages ?? []);
  const defaultPlan = allPackages.find((p) => p.popular) ?? allPackages[0];
  const [planId, setPlanId] = useState(defaultPlan?.id ?? '');
  const plan = allPackages.find((p) => p.id === planId) ?? allPackages[0];
  const [qty, setQty] = useState(catalog.usage?.defaultQty ?? catalog.bulk?.defaultQty ?? 1);
  // Usage pricing: rate from the highest tier whose `min` the count meets.
  const usageRate = (() => {
    if (!catalog.usage) return 0;
    let r = catalog.usage.tiers[0]?.rate ?? 0;
    for (const t of catalog.usage.tiers) if (qty >= t.min) r = t.rate;
    return r;
  })();
  const priceText = isUsage
    ? `$${usageRate.toFixed(3)}/${catalog.usage!.unit}`
    : (plan?.priceLabel ?? (catalog.bulk ? `$${plan?.price}/${catalog.bulk.unit}` : `$${plan?.price}`));

  // Upsells come from the shared @heva/catalog; `picks` maps addonId → chosen tierId.
  const addons = resolveAddOns(catalog.addons ?? []);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const toggleAddon = (a: AddOn) =>
    setPicks((p) => {
      const next = { ...p };
      if (a.id in next) delete next[a.id];
      else next[a.id] = a.tiers[0].id;
      return next;
    });
  const setTier = (addonId: string, tierId: string) => setPicks((p) => ({ ...p, [addonId]: tierId }));
  const tierOf = (a: AddOn): AddOnTier | undefined => a.tiers.find((t) => t.id === picks[a.id]);
  const chosen = addons
    .filter((a) => a.id in picks)
    .map((a) => ({ addon: a, tier: tierOf(a) ?? a.tiers[0] }));

  const bumpsSum = chosen.reduce((s, c) => s + c.tier.price, 0);
  const saved = chosen.reduce((s, c) => s + (c.tier.strike && c.tier.strike > c.tier.price ? c.tier.strike - c.tier.price : 0), 0);
  const savedBase = chosen.reduce((s, c) => s + (c.tier.strike && c.tier.strike > c.tier.price ? c.tier.strike : 0), 0);
  const subtotal = isUsage ? usageRate * qty : catalog.bulk ? (plan?.price ?? 0) * qty : (plan?.price ?? 0);
  const bulkDiscount = catalog.bulk && qty >= catalog.bulk.minDiscountQty ? Math.round(subtotal * catalog.bulk.discountPct) / 100 : 0;
  const total = subtotal - bulkDiscount + bumpsSum;
  const totalText = isUsage ? `$${total.toFixed(2)}` : (plan?.priceLabel ?? `$${total}`);

  function place(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const domain = String(fd.get('project') || projects[0]?.domain || 'new-order');
    const id = `${catalog.orderCode}-${Math.floor(1000 + Math.random() * 9000)}`;
    const order: Order = {
      id,
      date: todayUS(),
      title: catalog.orderTitle,
      service: catalog.key,
      domain,
      sub: isUsage
        ? `${qty.toLocaleString('en-US')} ${catalog.usage!.unitPlural} · $${usageRate.toFixed(3)}/${catalog.usage!.unit}`
        : `${catalog.bulk ? `${qty} × ` : ''}${plan?.name} · ${plan?.summary}${chosen.length ? ` · +${chosen.length} add-on${chosen.length > 1 ? 's' : ''}` : ''}`,
      status: 'planned',
      priority: 'med',
      progress: null,
      detail: 'Awaiting kickoff',
      eta: isUsage ? 'By volume' : (plan?.sla ?? ''),
      owner: 'Unassigned',
      cost: total,
      pay: 'pending',
      invoice: null,
    };
    addOrder(order);
    toast(`Order #${id} placed — it's on your board`, 'success');
    router.push('/orders');
  }

  const renderCard = (p: SvcPackage) => {
    const active = p.id === planId;
    return (
      <label
        key={p.id}
        className={`relative flex cursor-pointer flex-col rounded-2xl border bg-card p-4 transition ${
          active ? 'border-primary ring-2 ring-primary/30 shadow-sm' : 'border-border hover:border-primary/50'
        }`}
      >
        <input type="radio" name="plan" value={p.id} checked={active} onChange={() => setPlanId(p.id)} className="sr-only" />
        {p.popular && (
          <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Popular</span>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`}>
              <i className="ph-bold ph-check text-[9px]" />
            </span>
            {p.name}
          </span>
          <span className="display text-lg font-bold tracking-tight">{p.priceLabel ?? `$${p.price}`}</span>
        </div>
        <p className="mt-1.5 pl-6 text-[11px] text-muted-foreground">{p.summary}</p>
        <p className="mt-1 pl-6 text-[11px] font-medium text-muted-foreground"><i className="ph-bold ph-clock mr-1 text-primary" />{p.sla}</p>
        <ul className="mt-2.5 space-y-1.5 border-t border-border/70 pl-6 pt-2.5 text-[11px] text-muted-foreground">
          {p.features.map((ft) => (
            <li key={ft} className="flex items-start gap-1.5"><i className="ph-bold ph-check mt-0.5 text-primary" /><span>{ft}</span></li>
          ))}
        </ul>
      </label>
    );
  };

  return (
    <form onSubmit={place} className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {/* usage: submit a list → priced per unit */}
        {isUsage && catalog.usage ? (
          <fieldset>
            <legend className="text-sm font-semibold">Submit your links</legend>
            <p className="mt-1 text-xs text-muted-foreground">Paste, upload or link your URLs — priced per link, cheaper at volume.</p>
            <div className="mt-3">
              <UsageLinkList usage={catalog.usage} onCount={setQty} />
            </div>
          </fieldset>
        ) : (
        /* package picker */
        <fieldset>
          <legend className="text-sm font-semibold">Choose a plan</legend>
          {catalog.groups ? (
            <div className="mt-3 space-y-5">
              {catalog.groups.map((g) => (
                <div key={g.id}>
                  <div className="flex items-center gap-2">
                    {g.icon && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><i className={`ph-bold ${g.icon}`} /></span>}
                    <div>
                      <p className="text-sm font-semibold">{g.title}</p>
                      {g.subtitle && <p className="text-[11px] text-muted-foreground">{g.subtitle}</p>}
                    </div>
                  </div>
                  <div className={`mt-2 grid gap-3 ${g.packages.length === 1 ? '' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                    {g.packages.map(renderCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(catalog.packages ?? []).map(renderCard)}
            </div>
          )}
        </fieldset>
        )}

        {/* brief */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-note-pencil text-primary" /> Project brief</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold">Apply to project<span className="text-primary"> *</span></label>
              <select name="project" required defaultValue={projects[0]?.domain} className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20">
                {projects.map((p) => (
                  <option key={p.domain} value={p.domain}>{p.name} · {p.domain}</option>
                ))}
              </select>
            </div>
            {catalog.fields.map(field)}
          </div>
        </div>

        {/* bulk keyword list — drives the article count for bulk services */}
        {catalog.bulk && <BulkKeywordList bulk={catalog.bulk} onCount={setQty} />}

        {/* add-on details — revealed for ticked upsells (uses the chosen tier's fields) */}
        {chosen.some((c) => c.tier.fields && c.tier.fields.length > 0) && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-plus-circle text-emerald-600" /> Add-on details</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">A couple of extras for the add-ons you picked — we reuse the project &amp; contact details, so nothing&apos;s asked twice.</p>
            <div className="mt-4 space-y-4">
              {chosen.filter((c) => c.tier.fields && c.tier.fields.length > 0).map(({ addon, tier }) => (
                <div key={addon.id} className="rounded-xl border border-border bg-card p-3.5">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold"><i className={`ph-bold ${addon.icon} text-primary`} /> {addon.name} · {tier.name}</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {tier.fields!.map(field)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* summary */}
      <aside className="h-max lg:sticky lg:top-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/40 px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-receipt text-primary" /> Order summary</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{isUsage ? 'Service' : 'Selected plan'}</p>
                <p className="display text-base font-bold tracking-tight">{isUsage ? catalog.name : <>{catalog.name} · {plan?.name}</>}</p>
              </div>
              <p className="display text-xl font-bold tracking-tight text-primary">{priceText}</p>
            </div>
            {isUsage && catalog.usage ? (
              <>
                <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[13px]">
                  <div className="flex items-center justify-between"><span className="capitalize text-muted-foreground">{catalog.usage.unitPlural}</span><span className="font-medium">× {qty.toLocaleString('en-US')}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Rate</span><span className="font-medium">${usageRate.toFixed(3)}/{catalog.usage.unit}</span></div>
                </div>
                <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                  {catalog.included.slice(0, 3).map((b) => (
                    <li key={b.title} className="flex items-start gap-2"><i className="ph-fill ph-check-circle mt-0.5 shrink-0 text-primary" /><span>{b.title}</span></li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <i className="ph-bold ph-clock text-primary" /> Delivery {plan?.sla}
                </p>
                <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                  {(plan?.features ?? []).slice(0, 4).map((ft) => (
                    <li key={ft} className="flex items-start gap-2"><i className="ph-fill ph-check-circle mt-0.5 shrink-0 text-primary" /><span>{ft}</span></li>
                  ))}
                </ul>
              </>
            )}

            {catalog.bulk && (
              <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-[13px]">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Per {catalog.bulk.unit}</span><span className="font-medium">${plan?.price}</span></div>
                <div className="flex items-center justify-between"><span className="capitalize text-muted-foreground">{catalog.bulk.unitPlural}</span><span className="font-medium">× {qty}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">${subtotal}</span></div>
                {bulkDiscount > 0 && (
                  <div className="flex items-center justify-between font-semibold text-emerald-600"><span>Bulk discount (−{catalog.bulk.discountPct}%)</span><span>−${bulkDiscount}</span></div>
                )}
              </div>
            )}

            {addons.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary"><i className="ph-fill ph-plus-circle" /> Add &amp; save — checkout-only</p>
                <div className="mt-2 space-y-2">
                  {addons.map((a) => {
                    const on = a.id in picks;
                    const tier = tierOf(a) ?? a.tiers[0];
                    const pct = on && tier.strike ? Math.round(((tier.strike - tier.price) / tier.strike) * 100) : 0;
                    return (
                      <div key={a.id} className={`rounded-xl border p-2.5 transition ${on ? 'border-primary bg-primary/[0.04] ring-1 ring-primary/30' : 'border-border hover:border-primary/50'}`}>
                        <label className="flex cursor-pointer gap-2.5">
                          <input type="checkbox" checked={on} onChange={() => toggleAddon(a)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-[13px] font-semibold">{a.name}</span>
                              {on && (
                                <span className="shrink-0 whitespace-nowrap">
                                  <span className="display text-[13px] font-bold">+${tier.price}</span>
                                  {tier.strike && <span className="ml-1 text-[10px] text-muted-foreground line-through">${tier.strike}</span>}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 flex items-start justify-between gap-2">
                              <span className="text-[11px] leading-snug text-muted-foreground">{a.headline}</span>
                              {pct > 0 && <span className="mt-px shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">−{pct}%</span>}
                            </span>
                          </span>
                        </label>
                        {on && a.tiers.length > 1 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                            {a.tiers.map((t) => (
                              <button
                                type="button"
                                key={t.id}
                                onClick={() => setTier(a.id, t.id)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${picks[a.id] === t.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                              >
                                {t.name} · ${t.price}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Estimated total</span>
              <span className="display text-xl font-bold tracking-tight">{totalText}</span>
            </div>
            {saved > 0 && !plan?.priceLabel && (
              <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white"><i className="ph-fill ph-seal-percent text-[11px]" /></span>
                You save ${saved}{savedBase > 0 ? ` (${Math.round((saved / savedBase) * 100)}%)` : ''}
              </div>
            )}
            <button type="submit" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:bg-primary/90 active:scale-[.98]">
              Place order <i className="ph-bold ph-arrow-right" />
            </button>
            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">No charge yet — a specialist confirms scope &amp; final price within 24h.</p>
          </div>
        </div>
      </aside>
    </form>
  );
}
