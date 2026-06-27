import { notFound } from 'next/navigation';
import Link from 'next/link';
import { docForStaff, FORMAT_META, audienceMeta, type DocBlock } from '@/data/staffDocs';
import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const RES_ICON: Record<string, string> = { link: 'ph-link-simple', file: 'ph-file-arrow-down', video: 'ph-play-circle' };

export default async function DocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = await currentStaffId();
  const me = STAFF.find((s) => s.id === sid);
  const doc = docForStaff(id, me?.skills ?? []);

  // Not found OR not permitted for this specialty — treated identically so existence never leaks.
  if (!doc) notFound();

  const fmt = FORMAT_META[doc.format];
  const aud = audienceMeta(doc.audience);

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/staff/docs" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
        <i className="ph-bold ph-arrow-left" aria-hidden /> Back to docs
      </Link>

      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5" style={{ backgroundColor: `${aud.color}1a`, color: aud.color }}>
            <i className={`ph-fill ${aud.icon}`} aria-hidden /> {aud.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-muted-foreground">
            <i className={`ph-bold ${fmt.icon}`} aria-hidden /> {fmt.label}
          </span>
        </div>
        <h1 className="display text-3xl font-bold tracking-tight">{doc.title}</h1>
        <p className="mt-2 text-base text-muted-foreground">{doc.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border pb-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><i className="ph-bold ph-user" aria-hidden /> {doc.author}</span>
          <span className="inline-flex items-center gap-1"><i className="ph-bold ph-clock" aria-hidden /> {doc.readMins} min read</span>
          <span className="inline-flex items-center gap-1"><i className="ph-bold ph-calendar-blank" aria-hidden /> Updated {fmtDate(doc.updatedAt)}</span>
        </div>
      </header>

      <div className="space-y-4">
        {doc.body.map((block, i) => <Block key={i} block={block} />)}
      </div>

      {doc.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-1.5">
          {doc.tags.map((t) => (
            <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">#{t}</span>
          ))}
        </div>
      )}

      {doc.resources.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Resources</h2>
          <ul className="space-y-2">
            {doc.resources.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kcard flex items-center gap-2 text-sm font-medium transition hover:border-primary/40"
                >
                  <i className={`ph-bold ${RES_ICON[r.kind] ?? 'ph-link-simple'} text-primary`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                  <i className="ph-bold ph-arrow-up-right text-muted-foreground" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-8 flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
        <i className="ph-bold ph-lock-simple" aria-hidden /> Published by admin · read-only. Spotted something out of date? Let your manager know.
      </p>
    </article>
  );
}

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'h':
      return <h2 className="display mt-2 text-xl font-bold tracking-tight">{block.text}</h2>;
    case 'p':
      return <p className="text-[15px] leading-relaxed text-foreground/90">{block.text}</p>;
    case 'ul':
      return (
        <ul className="space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-foreground/90">
              <i className="ph-bold ph-check mt-1 shrink-0 text-primary" aria-hidden />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-foreground/90">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
              <span>{it}</span>
            </li>
          ))}
        </ol>
      );
    case 'code':
      return (
        <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 text-[13px] leading-relaxed">
          <code className="font-mono whitespace-pre">{block.text}</code>
        </pre>
      );
    case 'callout': {
      const tone = CALLOUT[block.tone];
      return (
        <div className={`flex gap-2.5 rounded-lg border-l-2 p-3 text-sm ${tone.cls}`}>
          <i className={`ph-fill ${tone.icon} mt-0.5 shrink-0`} aria-hidden />
          <span className="leading-relaxed">{block.text}</span>
        </div>
      );
    }
  }
}

const CALLOUT: Record<'info' | 'tip' | 'warn', { icon: string; cls: string }> = {
  info: { icon: 'ph-info', cls: 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  tip: { icon: 'ph-lightbulb', cls: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  warn: { icon: 'ph-warning', cls: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
};
