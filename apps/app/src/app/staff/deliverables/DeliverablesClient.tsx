'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SlideOver } from '@/components/shared/SlideOver';
import { CareTags } from '@/components/staff/CareTags';
import { serviceMeta, deliverablesFor, reworkCount } from '@/data/staffMock';
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
          {shown.map((r) => { const m = serviceMeta(r.service); const needs = r.d.status === 'changes_requested'; const rework = reworkCount(r.taskId); return (
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
  const reviewTone = d.status === 'approved' ? 'emerald' : d.status === 'changes_requested' ? 'amber' : null;
  return (
    <SlideOver open onClose={onClose} title={`${taskCode} · v${d.version}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`pill ${PILL[d.status] ?? 'pill'}`}>{LABEL[d.status] ?? d.status}</span>
          <span className="text-xs text-muted-foreground">{customer}</span>
          <CareTags company={customer} />
          <Link href={`/staff/tasks/${taskId}`} className="ml-auto text-xs font-semibold text-primary hover:underline">Open task →</Link>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <KV label="Kind" value={d.kind === 'link' ? 'Link' : 'File'} />
          <KV label="Submitted" value={d.submittedAt} />
          <KV label="Reviewed" value={d.reviewedAt ?? '—'} />
          <KV label="Rework rounds" value={`${reworkCount(taskId)}`} />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Attachment</p>
          <p className="flex items-center gap-1.5 break-all rounded-lg border border-border px-2.5 py-1.5 text-sm">
            <i className={`ph-bold ${d.kind === 'link' ? 'ph-link' : 'ph-file-text'} text-muted-foreground`} />{d.fileName ?? d.url}
          </p>
        </div>

        {d.note && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your note to the reviewer</p>
            <p className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">{d.note}</p>
          </div>
        )}

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reviewer feedback</p>
          {d.reviewNote ? (
            <p className={`rounded-lg px-2.5 py-2 text-sm ${reviewTone === 'amber' ? 'border-l-2 border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100' : 'border-l-2 border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'}`}>
              <i className={`ph-bold ${d.status === 'changes_requested' ? 'ph-arrow-counter-clockwise' : 'ph-seal-check'} mr-1`} />{d.reviewNote}
            </p>
          ) : <p className="rounded-lg border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground">Awaiting review — no feedback yet.</p>}
        </div>

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
    </SlideOver>
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
