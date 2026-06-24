'use client';

import { useEffect, useState } from 'react';
import type { SvcUsage } from '@/data/services';

const cell =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20';

/** Returns the index of the highest tier whose `min` the count meets. */
function tierIndex(tiers: SvcUsage['tiers'], n: number): number {
  let idx = 0;
  tiers.forEach((t, i) => { if (n >= t.min) idx = i; });
  return idx;
}

/** Submit a URL list (paste / upload / Sheet) → live count, for usage-priced services. */
export function UsageLinkList({ usage, onCount }: { usage: SvcUsage; onCount: (n: number) => void }) {
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [text, setText] = useState('');
  const [manual, setManual] = useState(usage.defaultQty);
  const [fileName, setFileName] = useState('');

  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean).length;
  const count = mode === 'paste' ? lines : manual;
  useEffect(() => { onCount(count); }, [count, onCount]);
  const active = tierIndex(usage.tiers, count);

  const tab = (m: 'paste' | 'file', label: string, icon: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`rounded-md px-3 py-1.5 transition ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <i className={`ph-bold ${icon} mr-1`} />{label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-link text-primary" /> Your backlink URLs</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {mode === 'paste'
                ? count > 0 ? `${count.toLocaleString('en-US')} URLs detected` : 'Paste your URLs — one per line.'
                : "We'll confirm the exact count from your file / sheet."}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="display text-2xl font-bold leading-none text-primary">{count.toLocaleString('en-US')}</p>
            <p className="text-[11px] font-medium text-muted-foreground">{usage.unitPlural}</p>
          </div>
        </div>

        <div className="mt-3 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 text-xs font-semibold">
          {tab('paste', 'Paste URLs', 'ph-list-bullets')}
          {tab('file', 'Upload / Google Sheet', 'ph-table')}
        </div>

        {mode === 'paste' ? (
          <div className="mt-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              name="links"
              rows={6}
              placeholder={'https://site.com/your-backlink-1\nhttps://site.com/your-backlink-2\n…'}
              className={`${cell} resize-y leading-relaxed`}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">One URL per line. We push each into Google&apos;s index and report the status.</p>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] p-3 text-[11px] leading-relaxed text-muted-foreground">
              <i className="ph-fill ph-info mt-0.5 shrink-0 text-primary" />
              <span>Paste your URLs into {usage.sampleUrl ? (<a href={usage.sampleUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">our sample sheet</a>) : 'a sheet'}. If you share a Sheet link, <b className="font-semibold text-foreground">grant access to hello@hevaseo.com</b>.</span>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background p-4 transition hover:border-primary/50">
              <i className="ph-bold ph-table text-2xl text-primary" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{fileName || 'Upload .csv / .txt / .xlsx'}</span><span className="block text-[11px] text-muted-foreground">One URL per row.</span></span>
              <input type="file" name="links_file" accept=".csv,.txt,.xlsx,.xls" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
              <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Browse</span>
            </label>
            <div className="my-3 flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground"><span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" /></div>
            <input type="url" name="links_sheet" placeholder="Paste your Google Sheet link" className={cell} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="usage-count" className="text-xs font-medium">Number of {usage.unitPlural}</label>
              <input id="usage-count" type="number" min={1} value={manual} onChange={(e) => setManual(Math.max(1, Number(e.target.value) || 0))} className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {usage.tiers.map((t, i) => (
          <div key={t.label} className={`rounded-xl border p-3 text-center transition ${i === active ? 'border-primary ring-2 ring-primary/30 shadow-sm' : 'border-border bg-card'}`}>
            <p className="display text-lg font-bold text-primary">${t.rate.toFixed(3)}<span className="text-[11px] font-medium text-muted-foreground">/{usage.unit}</span></p>
            <p className="mt-0.5 text-[11px] font-semibold">{t.label}</p>
            {t.sub && <p className="text-[10px] text-muted-foreground">{t.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
