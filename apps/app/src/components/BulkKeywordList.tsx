'use client';

import { useEffect, useState } from 'react';
import type { SvcBulk } from '@/data/services';

const cell =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20';

/** Keyword list for bulk content orders — one article per row, or upload / Sheet with a manual count. */
export function BulkKeywordList({ bulk, onCount }: { bulk: SvcBulk; onCount: (n: number) => void }) {
  const [mode, setMode] = useState<'rows' | 'file'>('rows');
  const [keywords, setKeywords] = useState<string[]>(['', '', '']);
  const [manualCount, setManualCount] = useState(bulk.defaultQty);
  const [fileName, setFileName] = useState('');

  const rowsCount = keywords.filter((k) => k.trim()).length;
  const count = mode === 'rows' ? rowsCount : manualCount;
  useEffect(() => { onCount(count); }, [count, onCount]);

  const setKw = (i: number, v: string) => setKeywords((arr) => arr.map((k, j) => (j === i ? v : k)));
  const addRow = () => setKeywords((arr) => [...arr, '']);
  const removeRow = (i: number) => setKeywords((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr));

  const tab = (m: 'rows' | 'file', label: string, icon: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`rounded-md px-3 py-1.5 transition ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <i className={`ph-bold ${icon} mr-1`} aria-hidden />{label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-list-bullets text-primary" aria-hidden /> Keyword list — one {bulk.unit} per row</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {mode === 'rows'
              ? rowsCount > 0 ? `${rowsCount} ${rowsCount === 1 ? bulk.unit : bulk.unitPlural} — one per keyword row.` : 'Add a keyword to each row — one article per row.'
              : "We'll confirm the exact count from your file / sheet."}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="display text-2xl font-bold leading-none text-primary">{count}</p>
          <p className="text-[11px] font-medium text-muted-foreground">{bulk.unitPlural}</p>
        </div>
      </div>

      <div className="mt-3 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 text-xs font-semibold">
        {tab('rows', 'Add keywords', 'ph-list-bullets')}
        {tab('file', 'Upload / Google Sheet', 'ph-table')}
      </div>

      {mode === 'rows' ? (
        <div className="mt-3">
          <div className="hidden gap-2 px-1 pb-1 text-[10px] font-medium text-muted-foreground sm:grid sm:grid-cols-[1.2fr_1fr_1fr_auto]">
            <span>Keyword(s) for the article</span>
            <span>Internal link URL · optional</span>
            <span>Reference URL · optional</span>
            <span />
          </div>
          <div className="space-y-2">
            {keywords.map((k, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
                <input value={k} onChange={(e) => setKw(i, e.target.value)} name="kw_keyword" placeholder="best running shoes for flat feet" className={cell} />
                <input name="kw_internal" placeholder="/related-page" className={cell} />
                <input name="kw_reference" type="url" placeholder="https://ref.com/article" className={cell} />
                <button type="button" onClick={() => removeRow(i)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-rose-400/50 hover:text-rose-500" aria-label="Remove row"><i className="ph-bold ph-x" aria-hidden /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5"><i className="ph-bold ph-plus" aria-hidden /> Add article</button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] p-3 text-[11px] leading-relaxed text-muted-foreground">
            <i className="ph-fill ph-info mt-0.5 shrink-0 text-primary" aria-hidden />
            <span>
              Fill keywords & clusters using {bulk.sampleUrl ? (<a href={bulk.sampleUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">our sample Google Sheet</a>) : 'our template'}. If you share a Sheet link, <b className="font-semibold text-foreground">grant access to hello@hevaseo.com</b>.
            </span>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background p-4 transition hover:border-primary/50">
            <i className="ph-bold ph-table text-2xl text-primary" aria-hidden />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{fileName || 'Upload your .xlsx / .csv'}</span><span className="block text-[11px] text-muted-foreground">Matching our template columns.</span></span>
            <input type="file" name="keywords_file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
            <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Browse</span>
          </label>
          <div className="my-3 flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground"><span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" /></div>
          <input type="url" name="keywords_sheet" placeholder="Paste your Google Sheet link" className={cell} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="bulk-count" className="text-xs font-medium">Number of SEO {bulk.unitPlural}</label>
            <input id="bulk-count" type="number" min={1} max={1000} value={manualCount} onChange={(e) => setManualCount(Math.max(1, Number(e.target.value) || 0))} className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
      )}
    </div>
  );
}
