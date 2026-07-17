'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { resolveAddOns, type AddOn, type AddOnTier } from '@heva/catalog';
import { BulkKeywordList } from './BulkKeywordList';
import { UsageLinkList } from './UsageLinkList';
import { useProjects } from './ProjectsStore';
import { useToast } from './Toast';
import { MEMBERSHIP_DISCOUNT, type IntakeField } from '@/data/mock';
import { UUID_RE } from '@/lib/orderMap';
import type { SvcCatalog, SvcField, SvcPackage } from '@/data/services';
import { placeOrderAction } from '@/app/(portal)/order.actions';

type ProjectOption = { name: string; domain: string };

const AUTO = '__auto';
const NEW_PROJECT = '__new';
const NEW_FOLDER = '__newfolder';
const RAND_ADJ = ['Lumen', 'Apex', 'Nova', 'Vertex', 'Quartz', 'Cobalt', 'Harbor', 'Summit', 'Atlas', 'Cedar', 'Orbit', 'Pioneer'];
const RAND_NOUN = ['Labs', 'Media', 'Group', 'Studio', 'Works', 'Digital', 'Collective', 'Ventures'];
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const cleanDomain = (raw: string) => raw.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
const randomProjectName = () => `${pick(RAND_ADJ)} ${pick(RAND_NOUN)}`;

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

/** Read each brief field's submitted value into a label/value list for the order detail. */
function captureFields(fields: SvcField[], fd: FormData, labelPrefix = ''): IntakeField[] {
  const out: IntakeField[] = [];
  for (const f of fields) {
    const full = f.colSpan === 2 || f.as === 'textarea' || f.as === 'keyword-rows';
    const label = labelPrefix ? `${labelPrefix}: ${f.label}` : f.label;
    if (f.as === 'keyword-rows') {
      const rows = fd.getAll(`${f.name}_keyword`).map(String).map((s) => s.trim()).filter(Boolean);
      if (rows.length) out.push({ label, value: rows.join('\n'), full: true });
      continue;
    }
    const raw = String(fd.get(f.name) ?? '').trim();
    if (!raw) continue;
    const value = f.as === 'select' ? (f.options?.find((o) => o.value === raw)?.label ?? raw) : raw;
    out.push({ label, value, full });
  }
  return out;
}

export function ServiceOrder({ catalog, onPlaced, stacked = false, presetDomain, isVip = false }: { catalog: SvcCatalog; onPlaced?: () => void; stacked?: boolean; presetDomain?: string; isVip?: boolean }) {
  const router = useRouter();
  const { projects: allStoreProjects, folders: storeFolders } = useProjects();
  // The brief's Project picker only offers ACTIVE projects — deleted ones are already gone from the DB,
  // and archived ones (moved to Archive) must not resurface here either.
  const storeProjects = allStoreProjects.filter((p) => !p.archived);
  const projects: ProjectOption[] = storeProjects.map((p) => ({ name: p.name, domain: p.domain }));
  const toast = useToast();
  // When the order is started from inside a project (e.g. the project detail page),
  // preselect that project + its folder instead of defaulting to Auto.
  const presetProj = presetDomain ? storeProjects.find((p) => p.domain === presetDomain) : undefined;

  const isUsage = !!catalog.usage;
  const allPackages = catalog.groups ? catalog.groups.flatMap((g) => g.packages) : (catalog.packages ?? []);
  const defaultPlan = allPackages.find((p) => p.popular) ?? allPackages[0];
  const [planId, setPlanId] = useState(defaultPlan?.id ?? '');
  const plan = allPackages.find((p) => p.id === planId) ?? allPackages[0];

  // Project + folder assignment. Default is "auto" — we pick one for them and they
  // can rename / move it later. They can also target an existing project or a new one.
  const [proj, setProj] = useState<string>(presetProj ? presetProj.domain : AUTO);
  const [folderId, setFolderId] = useState<string>(presetProj ? (storeFolders.find((f) => f.id === presetProj.folder)?.id ?? AUTO) : AUTO);
  const [newName, setNewName] = useState('');
  const [autoName, setAutoName] = useState(true); // name the project after the website domain
  const [newFolderName, setNewFolderName] = useState('');
  const [orderTitle, setOrderTitle] = useState(''); // optional campaign / order title
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
  // VIP membership perk — 15% off, applied only to numeric totals (not "Consult"/"Custom quote" plans).
  const hasNumericTotal = isUsage || !plan?.priceLabel;
  // VIP perk applies only to real VIP-tier customers (server reprices the same way — inc-B3).
  const vipOff = isVip && hasNumericTotal ? (isUsage ? Math.round(total * MEMBERSHIP_DISCOUNT * 100) / 100 : Math.round(total * MEMBERSHIP_DISCOUNT)) : 0;
  const finalTotal = total - vipOff;
  const subtotalText = isUsage ? `$${total.toFixed(2)}` : `$${total}`;
  const totalText = isUsage ? `$${finalTotal.toFixed(2)}` : (plan?.priceLabel ?? `$${finalTotal}`);
  // A plan the catalog gives a priceLabel to has no total to charge — placing it asks for a quote, and
  // the server does exactly that (order.actions.ts gates on hasNumericTotal). The button has to say so:
  // "Place order" on a 'from $79' plan promises an order at $79, and neither half is true.
  const isQuotePlan = !hasNumericTotal;
  const submitLabel = isQuotePlan ? 'Request a quote' : 'Place order';

  /** Resolve the order's project + folder from the picker. The project is named after the website domain
   *  (from the Website URL field) unless the customer set a custom name; the folder is a brand-new one
   *  (created by name on submit), the picked one, or an auto default bucket. */
  function resolveAssignment(websiteUrl: string) {
    const urlDomain = cleanDomain(websiteUrl || '');
    const folder = folderId === NEW_FOLDER
      ? { id: '', name: newFolderName.trim() || 'New folder' }
      : folderId !== AUTO
        ? { id: folderId, name: storeFolders.find((f) => f.id === folderId)?.name ?? 'Uncategorized' }
        : { id: '', name: 'Uncategorized' }; // auto → default bucket (find-or-created server-side)

    // A project's domain is ONLY ever a real website the customer typed — never fabricated. When no website is
    // given the project has no domain and is titled by name/topic instead, so no fake domain leaks into the
    // card, its headline, or the tooltip.
    let domain: string, projectName: string, auto = false, isNew = false;
    if (proj === NEW_PROJECT) {
      isNew = true;
      domain = urlDomain; // '' when no website entered
      projectName = (autoName && urlDomain) ? urlDomain : (newName.trim() || urlDomain || randomProjectName());
    } else if (proj !== AUTO && proj !== '') {
      const ep = storeProjects.find((p) => p.domain === proj);
      domain = proj;
      projectName = ep?.name ?? proj;
    } else {
      auto = true;
      domain = urlDomain; // '' when no website entered
      projectName = urlDomain || randomProjectName();
    }
    return { domain, projectName, folderId: folder.id, folderName: folder.name, auto, isNew, newFolder: folderId === NEW_FOLDER };
  }

  const [placing, setPlacing] = useState(false);
  async function place(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    // The project domain comes from the Website URL the customer entered (single source, no duplicate field).
    const asg = resolveAssignment(String(fd.get('website') ?? ''));
    // Capture the brief the customer just filled in — assignment, plan, service fields, add-on fields.
    const intake: IntakeField[] = [
      { label: 'Project', value: asg.projectName === asg.domain ? asg.domain : `${asg.projectName} · ${asg.domain}`, full: true },
      { label: 'Folder', value: asg.auto ? `${asg.folderName} · auto-assigned — rename anytime` : asg.folderName },
      { label: isUsage ? 'Service' : 'Selected plan', value: isUsage ? `${qty.toLocaleString('en-US')} ${catalog.usage!.unitPlural}` : `${plan?.name}${catalog.bulk ? ` · ${qty} ${catalog.bulk.unitPlural}` : ''}` },
      ...captureFields(catalog.fields, fd),
      ...chosen.flatMap(({ addon, tier }) => captureFields(tier.fields ?? [], fd, addon.name)),
    ];
    // Usage services (Indexer) collect their URLs via UsageLinkList, not catalog.fields — persist them so the
    // card can show "N URLs from [domain] / M domains". Prefer the pasted list, else the sheet link.
    if (isUsage) {
      const submitted = String(fd.get('links') ?? '').trim() || String(fd.get('links_sheet') ?? '').trim();
      if (submitted) intake.push({ label: 'Submitted URLs', value: submitted, full: true });
    }
    // Real placement: the server reprices + debits credit via create_order (the client price is only
    // an estimate). The order then shows up on the board via the real RLS-scoped read.
    setPlacing(true);
    const res = await placeOrderAction({
      serviceKey: catalog.key, packageId: planId, qty, addonPicks: picks,
      project: asg.projectName, folder: asg.folderName,
      // the server find-or-creates the REAL project/folder rows and FKs the order to them (inc — project wiring)
      projectDomain: asg.domain, folderId: UUID_RE.test(asg.folderId) ? asg.folderId : null,
      // campaign title (blank → server auto "Nth {service} order for {domain}") + the submitted site URL
      title: orderTitle.trim() || undefined, site: String(fd.get('website') ?? '').trim() || undefined,
      brief: intake,
    });
    setPlacing(false);
    if (!res.ok) { toast(res.error, 'error'); return; }
    // A 'Consult' plan doesn't place an order — it asks for a quote, and nothing is charged. Saying
    // "Order … placed — credit charged" here would be two lies in one line.
    if ('quoteRequested' in res) {
      toast(res.message, 'success');
      if (onPlaced) onPlaced();
      router.refresh();
      return;
    }
    toast(`Order ${res.code} placed — credit charged`, 'success');
    if (onPlaced) onPlaced();
    else router.push('/orders');
    router.refresh();
  }

  const renderCard = (p: SvcPackage) => {
    const active = p.id === planId;
    const radioDot = (
      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`}>
        <i className="ph-bold ph-check text-[9px]" aria-hidden />
      </span>
    );

    // Stacked (slide-over): one card per row — name + price on top, then the
    // features spread across the full width below. Keeps each card compact.
    if (stacked) {
      return (
        <label
          key={p.id}
          className={`relative flex cursor-pointer flex-col gap-3 rounded-2xl border bg-card p-4 transition ${
            active ? 'border-primary ring-2 ring-primary/30 shadow-sm' : 'border-border hover:border-primary/50'
          }`}
        >
          <input type="radio" name="plan" value={p.id} checked={active} onChange={() => setPlanId(p.id)} className="sr-only" />
          {p.popular && (
            <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Popular</span>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="flex items-center gap-1.5 font-semibold">{radioDot}{p.name}</span>
              <p className="mt-1 text-[12px] text-muted-foreground">{p.summary}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="display text-lg font-bold tracking-tight">{p.priceLabel ?? `$${p.price}`}</div>
              <div className="mt-0.5 whitespace-nowrap text-[11px] font-medium text-muted-foreground"><i className="ph-bold ph-clock mr-1 text-primary" aria-hidden />{p.sla}</div>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-border/70 pt-3 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
            {p.features.map((ft) => (
              <li key={ft} className="flex items-start gap-1.5"><i className="ph-bold ph-check mt-0.5 shrink-0 text-primary" aria-hidden /><span>{ft}</span></li>
            ))}
          </ul>
        </label>
      );
    }

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
        <div className="flex items-start gap-1.5">
          {radioDot}
          <span className="min-w-0 flex-1 font-semibold leading-tight">{p.name}</span>
        </div>
        <p className="display mt-1.5 pl-6 text-xl font-bold leading-none tracking-tight">{p.priceLabel ?? `$${p.price}`}</p>
        <p className="mt-1.5 pl-6 text-[11px] text-muted-foreground">{p.summary}</p>
        <p className="mt-1 pl-6 text-[11px] font-medium text-muted-foreground"><i className="ph-bold ph-clock mr-1 text-primary" aria-hidden />{p.sla}</p>
        <ul className="mt-2.5 space-y-1.5 border-t border-border/70 pl-6 pt-2.5 text-[11px] text-muted-foreground">
          {p.features.map((ft) => (
            <li key={ft} className="flex items-start gap-1.5"><i className="ph-bold ph-check mt-0.5 text-primary" aria-hidden /><span>{ft}</span></li>
          ))}
        </ul>
      </label>
    );
  };

  const ctrlCls = 'w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <form onSubmit={place} className={`grid items-start gap-5 ${stacked ? '' : 'lg:grid-cols-[1fr_320px]'}`}>
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
                    {g.icon && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><i className={`ph-bold ${g.icon}`} aria-hidden /></span>}
                    <div>
                      <p className="text-sm font-semibold">{g.title}</p>
                      {g.subtitle && <p className="text-[11px] text-muted-foreground">{g.subtitle}</p>}
                    </div>
                  </div>
                  <div className={`mt-2 grid gap-3 ${stacked || g.packages.length === 1 ? '' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                    {g.packages.map(renderCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`mt-3 grid gap-3 ${stacked ? '' : 'sm:grid-cols-3'}`}>
              {(catalog.packages ?? []).map(renderCard)}
            </div>
          )}
        </fieldset>
        )}

        {/* brief */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-note-pencil text-primary" aria-hidden /> Project brief</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* project + folder assignment — defaults to auto, editable later */}
            <div className="flex flex-col gap-3 sm:col-span-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold">Project</label>
                  <select value={proj} onChange={(e) => setProj(e.target.value)} className={ctrlCls}>
                    <option value={AUTO}>🎲 Auto — set one up for me</option>
                    {projects.length > 0 && (
                      <optgroup label="Existing projects">
                        {projects.map((p) => <option key={p.domain} value={p.domain}>{p.name} · {p.domain}</option>)}
                      </optgroup>
                    )}
                    <option value={NEW_PROJECT}>＋ New project…</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold">Folder</label>
                  <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className={ctrlCls}>
                    <option value={AUTO}>🎲 Auto</option>
                    {storeFolders.map((f) => <option key={f.id} value={f.id}>{f.parentId ? '— ' : ''}{f.name}</option>)}
                    <option value={NEW_FOLDER}>＋ New folder…</option>
                  </select>
                </div>
              </div>
              {proj === NEW_PROJECT && (
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <input type="checkbox" checked={autoName} onChange={(e) => setAutoName(e.target.checked)} className="accent-primary" />
                    Auto — name the project after my website domain
                  </label>
                  {autoName ? (
                    <p className="text-[11px] text-muted-foreground">We&apos;ll use the domain from your Website URL below (e.g. dantri.com).</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold">Project name</label>
                      <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Acme rebrand" className={ctrlCls} />
                    </div>
                  )}
                </div>
              )}
              {folderId === NEW_FOLDER && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/30 p-3">
                  <label className="text-xs font-semibold">New folder name</label>
                  <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g. Client work, Q3 campaigns" className={ctrlCls} />
                  <p className="text-[11px] text-muted-foreground">The project will be filed straight into this folder.</p>
                </div>
              )}
              {proj === AUTO && (
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <i className="ph-bold ph-info mt-px shrink-0 text-primary" aria-hidden />
                  We&apos;ll create a project{folderId === AUTO ? ' in a folder' : ''} for this order — rename or move it anytime in Projects.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Campaign / order title <span className="font-normal text-muted-foreground">(optional)</span></label>
                <input value={orderTitle} onChange={(e) => setOrderTitle(e.target.value)} placeholder="Leave blank — we'll title it e.g. “1st Backlink order for yoursite.com”" className={ctrlCls} />
              </div>
            </div>
            {catalog.fields.map(field)}
          </div>
        </div>

        {/* bulk keyword list — drives the article count for bulk services */}
        {catalog.bulk && <BulkKeywordList bulk={catalog.bulk} onCount={setQty} />}

        {/* add-on details — revealed for ticked upsells (uses the chosen tier's fields) */}
        {chosen.some((c) => c.tier.fields && c.tier.fields.length > 0) && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-plus-circle text-emerald-600" aria-hidden /> Add-on details</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">A couple of extras for the add-ons you picked — we reuse the project &amp; contact details, so nothing&apos;s asked twice.</p>
            <div className="mt-4 space-y-4">
              {chosen.filter((c) => c.tier.fields && c.tier.fields.length > 0).map(({ addon, tier }) => (
                <div key={addon.id} className="rounded-xl border border-border bg-card p-3.5">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold"><i className={`ph-bold ${addon.icon} text-primary`} aria-hidden /> {addon.name} · {tier.name}</p>
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
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-receipt text-primary" aria-hidden /> Order summary</p>
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
                    <li key={b.title} className="flex items-start gap-2"><i className="ph-fill ph-check-circle mt-0.5 shrink-0 text-primary" aria-hidden /><span>{b.title}</span></li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <i className="ph-bold ph-clock text-primary" aria-hidden /> Delivery {plan?.sla}
                </p>
                <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                  {(plan?.features ?? []).slice(0, 4).map((ft) => (
                    <li key={ft} className="flex items-start gap-2"><i className="ph-fill ph-check-circle mt-0.5 shrink-0 text-primary" aria-hidden /><span>{ft}</span></li>
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
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary"><i className="ph-fill ph-plus-circle" aria-hidden /> Add &amp; save — checkout-only</p>
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

            <div className="mt-4 space-y-1.5 border-t border-border pt-3">
              {vipOff > 0 && (
                <>
                  {!catalog.bulk && <div className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{subtotalText}</span></div>}
                  <div className="flex items-center justify-between text-[13px] font-semibold text-amber-600"><span className="inline-flex items-center gap-1.5"><i className="ph-fill ph-crown" aria-hidden /> VIP member −15%</span><span>−${vipOff}</span></div>
                </>
              )}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-sm font-semibold">Estimated total</span>
                <span className="display text-xl font-bold tracking-tight">{totalText}</span>
              </div>
            </div>
            {saved > 0 && !plan?.priceLabel && (
              <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white"><i className="ph-fill ph-seal-percent text-[11px]" aria-hidden /></span>
                You save ${saved}{savedBase > 0 ? ` (${Math.round((saved / savedBase) * 100)}%)` : ''}
              </div>
            )}
            <button type="submit" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:bg-primary/90 active:scale-[.98]">
              {submitLabel} <i className="ph-bold ph-arrow-right" aria-hidden />
            </button>
            {/* This said "No charge yet — a specialist confirms scope & final price within 24h" on EVERY
                plan, including the ones create_order debits the moment you click. Half the customers
                were told the opposite of what happens to their money. */}
            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
              {isQuotePlan
                ? 'No charge — a specialist prices this and sends you a quote to accept.'
                : `Your credit is charged when you place this order — ${totalText} today.`}
            </p>
          </div>
        </div>
      </aside>

      {/* sticky order bar — mobile only, where the summary sits far below the form */}
      <div className="sticky inset-x-0 bottom-3 z-40 mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur lg:hidden">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Estimated total</p>
          <p className="display text-lg font-bold leading-none">{totalText}</p>
        </div>
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[.98]">
          {submitLabel} <i className="ph-bold ph-arrow-right" aria-hidden />
        </button>
      </div>
    </form>
  );
}
