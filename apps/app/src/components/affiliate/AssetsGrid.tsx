'use client';
import { CopyButton } from './CopyButton';
import { marketingAssets, type MarketingAsset } from '@/data/affiliateMock';

function ImageAsset({ a }: { a: MarketingAsset }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid aspect-[16/9] place-items-center bg-gradient-to-br from-brand-500/15 via-muted to-card">
        <div className="text-center">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <i className={`ph-bold ${a.icon} text-lg`} />
          </span>
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">HevaSEO</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{a.title}</p>
          <p className="text-xs text-muted-foreground">{a.meta}</p>
        </div>
        <button type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted">
          <i className="ph-bold ph-download-simple" /> Download
        </button>
      </div>
    </div>
  );
}

function CopyAsset({ a }: { a: MarketingAsset }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><i className={`ph-bold ${a.icon} text-primary`} /> {a.title}</p>
        <span className="text-[11px] text-muted-foreground">{a.meta}</span>
      </div>
      <p className="mt-2 flex-1 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{a.body}</p>
      <div className="mt-3"><CopyButton value={a.body ?? ''} label="Copy text" /></div>
    </div>
  );
}

export function AssetsGrid({ limit }: { limit?: number }) {
  const all = marketingAssets();
  const images = all.filter((a) => a.kind !== 'copy');
  const copies = all.filter((a) => a.kind === 'copy');
  const shownImages = limit ? images.slice(0, limit) : images;
  const shownCopies = limit ? copies.slice(0, Math.max(0, limit - shownImages.length) || 1) : copies;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {shownImages.map((a) => <ImageAsset key={a.id} a={a} />)}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {shownCopies.map((a) => <CopyAsset key={a.id} a={a} />)}
      </div>
    </div>
  );
}
