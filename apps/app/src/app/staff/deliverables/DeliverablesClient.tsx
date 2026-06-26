'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SlideOver } from '@/components/shared/SlideOver';
import { CareTags } from '@/components/staff/CareTags';
import { serviceMeta, deliverablesFor, reworkCount, feedbackFor } from '@/data/staffMock';
import type { MyDeliverable, DeliverableStats } from '@/data/staffMock';

const PILL: Record<string, string> = { approved: 'pill-live', submitted: 'pill-good', changes_requested: 'pill-warn' };
const LABEL: Record<string, string> = { approved: 'Approved', submitted: 'In review', changes_requested: 'Changes requested' };

const TABS = [
  { key: 'all', label: 'All', status: null },
  { key: 'needs', label: 'Needs action', status: 'changes_requested' },
  { key: 'review', label: 'In review', status: 'submitted' },
  { key: 'approved', label: 'Approved', status: 'approved' },
] as const;

export function DeliverablesClient({ rows, stats }: { rows: MyDeliverable[]; stats: DeliverableStats }) {
  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [sel, setSel] = useState<MyDeliverable | null>(null);

  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (t && TABS.some((x) => x.key === t)) setTab(t); }, []);
  useEffect(() => { const url = new URL(window.location.href); if (tab === 'all') url.searchParams.delete('tab'); else url.searchParams.set('tab', tab); window.history.replaceState(null, '', `${url.pathname}${url.search}`); }, [tab]);

  const services = useMemo(() => [...new Set(rows.map((r) => r.service))].sort(), [rows]);
  const tabStatus = TABS.find((t) => t.key === tab)?.status ?? null;
  const shown = rows.filter((r) =>
    (!tabStatus || r.d.status === tabStatus) &&
    (!service || r.service === service) &&
    (!query.trim() || `${r.taskCode} ${r.service} ${r.customer} ${r.d.fileName ?? ''} ${r.d.url ?? ''}`.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon="ph-seal-check" label="Approved" value={String(stats.approved)} tone="text-emerald-500" />
        <Kpi icon="ph-magnifying-glass" label="In review" value={String(stats.inReview)} tone="text-primary" />
        <Kpi icon="ph-arrow-counter-clockwise" label="Needs changes" value={String(stats.reworking)} tone={stats.reworking ? 'text-amber-500' : 'text-muted-foreground'} />
        <Kpi icon="ph-target" label="First-pass rate" value={stats.firstPassRate === null ? '—' : `${stats.firstPassRate}%`} tone="text-primary" hint="Approved on v1, no rework" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg border border-border p-0.5">
          {TABS.map((t) => { const n = t.status ? rows.filter((r) => r.d.status === t.status).length : rows.length; return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-md px-3 py-1 text-sm font-semibold transition ${tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label} <span className={`ml-0.5 ${tab === t.key ? 'opacity-80' : 'opacity-60'}`}>{n}</span>
            </button>
          ); })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
            <i className="ph-bold ph-magnifying-glass text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search task, client, file…" aria-label="Search deliverables" className="w-40 bg-transparent outline-none" />
          </div>
          <select value={service} onChange={(e) => setService(e.target.value)} aria-label="Filter by service" className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary">
            <option value="">All services</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="kcard text-center text-sm text-muted-foreground"><i className="ph-bold ph-tray mb-1 block text-xl" />Nothing here.</div>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => { const m = serviceMeta(r.service); const needs = r.d.status === 'changes_requested'; const rework = reworkCount(r.taskId); const fb = feedbackFor(r.d.id); return (
            <li key={r.d.id}>
              <button onClick={() => setSel(r)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:bg-muted/40 ${needs ? 'border-l-[3px] border-l-amber-500 border-border' : 'border-border'}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${m.color}1a`, color: m.color }}><i className={`ph-bold ${m.icon}`} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold"><span className="font-mono text-xs text-muted-foreground">{r.taskCode}</span>{r.service}<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">v{r.d.version}</span></span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{r.customer}</span><CareTags company={r.customer} />
                    <span className="hidden items-center gap-1 sm:flex"><i className={`ph-bold ${r.d.kind === 'link' ? 'ph-link' : 'ph-file-text'}`} /><span className="max-w-[14rem] truncate">{r.d.fileName ?? r.d.url}</span></span>
                  </span>
                </span>
                {fb.customerRating && <span className="hidden shrink-0 items-center gap-0.5 text-[11px] font-semibold text-amber-500 sm:flex" title={`Customer rated ${fb.customerRating}/5`}><i className="ph-fill ph-star" />{fb.customerRating}.0</span>}
                <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{r.d.submittedAt}</span>
                {rework > 0 && <span className="hidden shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400 sm:block" title="Rework rounds">{rework}×</span>}
                <span className={`pill ${PILL[r.d.status] ?? 'pill'} shrink-0`}>{LABEL[r.d.status] ?? r.d.status}</span>
                <i className="ph-bold ph-caret-right shrink-0 text-muted-foreground" />
              </button>
            </li>
          ); })}
        </ul>
      )}
      <p className="px-1 text-xs text-muted-foreground"><i className="ph-bold ph-info mr-1" />Rework rounds feed your quality score — fewer is better, but iterating is normal.</p>

      {sel && <DetailPanel row={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function DetailPanel({ row, onClose }: { row: MyDeliverable; onClose: () => void }) {
  const { d, taskId, taskCode, customer } = row;
  const history = deliverablesFor(taskId); // oldest → newest
  const fb = feedbackFor(d.id);
  const managerNote = fb.managerNote ?? d.reviewNote;
  const changes = d.status === 'changes_requested';
  const [toast, setToast] = useState('');
  return (
    <SlideOver open onClose={onClose} title={`${taskCode} · v${d.version}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`pill ${PILL[d.status] ?? 'pill'}`}>{LABEL[d.status] ?? d.status}</span>
          <span className="text-xs text-muted-foreground">{customer}</span>
          <CareTags company={customer} />
          <Link href={`/staff/tasks/${taskId}`} className="ml-auto text-xs font-semibold text-primary hover:underline">Open order →</Link>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <KV label="Kind" value={d.kind === 'link' ? 'Link' : 'File'} />
          <KV label="Submitted" value={d.submittedAt} />
          <KV label="Reviewed" value={d.reviewedAt ?? '—'} />
          <KV label="Rework rounds" value={`${reworkCount(taskId)}`} />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">The deliverable</p>
          {d.kind === 'link' ? (
            <a href={d.url ?? '#'} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition hover:border-primary/60 hover:bg-muted/40">
              <span className="flex min-w-0 items-center gap-2"><i className="ph-bold ph-link text-primary" /><span className="truncate">{d.url}</span></span>
              <span className="shrink-0 font-semibold text-primary">Open link <i className="ph-bold ph-arrow-square-out" /></span>
            </a>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
              <span className="flex min-w-0 items-center gap-2"><i className="ph-bold ph-file-text text-muted-foreground" /><span className="truncate">{d.fileName}</span></span>
              <button onClick={() => { setToast('Demo build — the file isn’t stored.'); setTimeout(() => setToast(''), 2000); }} className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-download-simple mr-1" />Download</button>
            </div>
          )}
        </div>

        {d.note && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your note to the reviewer</p>
            <p className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">{d.note}</p>
          </div>
        )}

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Manager / QA review</p>
          {fb.managerRating || managerNote ? (
            <div className={`rounded-lg px-2.5 py-2 text-sm ${changes ? 'border-l-2 border-amber-500 bg-amber-500/10' : 'border-l-2 border-emerald-500 bg-emerald-500/10'}`}>
              <div className="flex flex-wrap items-center gap-2">
                {fb.managerRating ? <Stars value={fb.managerRating} /> : <span className="text-xs font-semibold">{changes ? 'Changes requested' : 'Reviewed'}</span>}
                {fb.reviewer && <span className="ml-auto text-xs text-muted-foreground">{fb.reviewer}{d.reviewedAt ? ` · ${d.reviewedAt}` : ''}</span>}
              </div>
              {managerNote && <p className="mt-1.5">{managerNote}</p>}
            </div>
          ) : <p className="rounded-lg border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground">Awaiting review — no feedback yet.</p>}
        </div>

        {(d.status === 'approved' || fb.customerRating) && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer rating</p>
            {fb.customerRating ? (
              <div className="rounded-lg border border-border px-2.5 py-2 text-sm">
                <div className="flex items-center gap-2"><Stars value={fb.customerRating} />{fb.customerRatedAt && <span className="ml-auto text-xs text-muted-foreground">{fb.customerRatedAt}</span>}</div>
                {fb.customerNote && <p className="mt-1.5 italic text-muted-foreground">“{fb.customerNote}”</p>}
              </div>
            ) : <p className="rounded-lg border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground">No customer rating yet — they’re reviewing the delivery.</p>}
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Version history</p>
          <ul className="space-y-1.5">
            {[...history].reverse().map((h) => (
              <li key={h.id} className={`rounded-lg border px-2.5 py-2 text-xs ${h.id === d.id ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">v{h.version}</span>
                  <span className={`pill ${PILL[h.status] ?? 'pill'}`}>{LABEL[h.status] ?? h.status}</span>
                  <span className="ml-auto text-muted-foreground">{h.reviewedAt ?? h.submittedAt}</span>
                </div>
                {h.reviewNote && <p className="mt-1 text-muted-foreground">“{h.reviewNote}”</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {toast && <div className="toast-in fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">{toast}</div>}
    </SlideOver>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={`ph-fill ph-star text-sm ${i <= value ? 'text-amber-500' : 'text-muted-foreground/30'}`} />)}
      <span className="ml-1 text-xs font-semibold">{value}.0</span>
    </span>
  );
}

function Kpi({ icon, label, value, tone, hint }: { icon: string; label: string; value: string; tone: string; hint?: string }) {
  return (
    <div className="kcard !p-3" title={hint}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${tone}`} />
      </div>
      <p className="display mt-1 text-2xl font-bold leading-none">{value}</p>
    </div>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-0.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
