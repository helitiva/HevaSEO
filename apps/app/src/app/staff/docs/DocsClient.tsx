'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/staff/EmptyState';
import { FORMAT_META, audienceMeta, type StaffDoc, type DocFormat } from '@/data/staffDocs';

interface SkillChip { key: string; label: string; icon: string; color: string }

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function DocsClient({ docs, skillChips }: { docs: StaffDoc[]; skillChips: SkillChip[] }) {
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<DocFormat | 'all'>('all');

  // Only the formats actually present in this staffer's permitted set become filter chips.
  const formats = useMemo(() => {
    const present = new Set(docs.map((d) => d.format));
    return (Object.keys(FORMAT_META) as DocFormat[]).filter((f) => present.has(f));
  }, [docs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (format !== 'all' && d.format !== format) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [docs, query, format]);

  const pinned = shown.filter((d) => d.pinned);
  const rest = shown.filter((d) => !d.pinned);

  return (
    <>
      {/* Scope banner — makes the access rule visible, not silent */}
      <div className="kcard mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-dashed bg-muted/40 text-xs">
        <i className="ph-bold ph-lock-key text-primary" aria-hidden />
        <span className="text-muted-foreground">You can read docs for</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 font-semibold">
          <i className="ph-fill ph-users-three text-muted-foreground" aria-hidden /> All staff
        </span>
        {skillChips.map((k) => (
          <span key={k.key} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 font-semibold">
            <i className={`ph-fill ${k.icon}`} style={{ color: k.color }} aria-hidden /> {k.label}
          </span>
        ))}
        <span className="text-muted-foreground">— docs for other specialties stay hidden.</span>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <FilterChip active={format === 'all'} onClick={() => setFormat('all')} label="All" />
          {formats.map((f) => (
            <FilterChip key={f} active={format === f} onClick={() => setFormat(f)} icon={FORMAT_META[f].icon} label={FORMAT_META[f].label} />
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        query || format !== 'all' ? (
          <EmptyState kind="no-match" />
        ) : (
          <div className="kcard flex flex-col items-center gap-2 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><i className="ph-bold ph-books text-2xl" aria-hidden /></span>
            <p className="display text-lg font-bold">No docs yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Nothing has been published for your specialty. Check back after admin adds material.</p>
          </div>
        )
      ) : (
        <div className="space-y-5">
          {pinned.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <i className="ph-fill ph-push-pin" aria-hidden /> Pinned
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pinned.map((d) => <DocCard key={d.id} doc={d} />)}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <i className="ph-fill ph-book-bookmark" aria-hidden /> Library
                </h2>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rest.map((d) => <DocCard key={d.id} doc={d} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FilterChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
    >
      {icon && <i className={`ph-bold ${icon}`} aria-hidden />} {label}
    </button>
  );
}

function DocCard({ doc }: { doc: StaffDoc }) {
  const fmt = FORMAT_META[doc.format];
  const aud = audienceMeta(doc.audience);
  return (
    <Link href={`/staff/docs/${doc.id}`} className="kcard group flex h-full flex-col gap-2 !cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: `${aud.color}1a`, color: aud.color }}
        >
          <i className={`ph-fill ${aud.icon}`} aria-hidden /> {aud.label}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <i className={`ph-bold ${fmt.icon}`} aria-hidden /> {fmt.label}
        </span>
      </div>
      <h3 className="display font-bold leading-snug transition group-hover:text-primary">{doc.title}</h3>
      <p className="line-clamp-2 text-sm text-muted-foreground">{doc.summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><i className="ph-bold ph-clock" aria-hidden /> {doc.readMins} min</span>
        <span className="inline-flex items-center gap-1"><i className="ph-bold ph-user" aria-hidden /> {doc.author}</span>
        <span className="inline-flex items-center gap-1"><i className="ph-bold ph-calendar-blank" aria-hidden /> Updated {fmtDate(doc.updatedAt)}</span>
      </div>
    </Link>
  );
}
