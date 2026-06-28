'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDocs, newDocId, todayIso } from '@/data/docsStore';
import { blocksToHtml, estimateReadMins } from '@/lib/docBody';
import { sanitizeHtml, htmlToText, htmlIsEmpty } from '@/lib/sanitizeHtml';
import { RichTextEditor } from '@/app/staff/notes/RichTextEditor';
import {
  FORMAT_META, audienceMeta, audiencesOf, DISTRIBUTABLE_AUDIENCES,
  type DocAudience, type DocFormat, type StaffDoc,
} from '@/data/staffDocs';

// Admin doc author + distributor. Compose a doc (markdown-lite body) and pick WHICH audiences
// receive it — customers, all staff, managers, or a specific skill pool. Multi-select, so one
// doc can go to several audiences at once. Saving publishes it to the shared docs store.
export function DocComposer({ editId }: { editId?: string }) {
  const router = useRouter();
  const { docs, saveDoc } = useDocs();
  const existing = useMemo(() => (editId ? docs.find((d) => d.id === editId) ?? null : null), [docs, editId]);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [format, setFormat] = useState<DocFormat>(existing?.format ?? 'guide');
  const [audiences, setAudiences] = useState<DocAudience[]>(existing ? audiencesOf(existing) : ['customer']);
  const [tags, setTags] = useState((existing?.tags ?? []).join(', '));
  const [pinned, setPinned] = useState(Boolean(existing?.pinned));
  // Rich-text HTML body. Seed from the doc's html, or convert its structured blocks if it
  // only has those (so an older doc still opens cleanly in the editor).
  const [bodyHtml, setBodyHtml] = useState(existing?.html ?? (existing ? blocksToHtml(existing.body) : ''));

  const toggleAudience = (a: DocAudience) =>
    setAudiences((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  const canSave = title.trim().length > 0 && audiences.length > 0 && !htmlIsEmpty(bodyHtml);

  const save = () => {
    if (!canSave) return;
    const id = existing?.id ?? newDocId();
    const html = sanitizeHtml(bodyHtml); // allowlist sanitize before it's ever stored/rendered
    const doc: StaffDoc = {
      id,
      title: title.trim(),
      audience: audiences[0],
      audiences,
      format,
      summary: summary.trim() || title.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      author: existing?.author ?? 'Admin',
      updatedAt: todayIso(),
      readMins: estimateReadMins(htmlToText(html)),
      body: [],
      html,
      resources: existing?.resources ?? [],
      pinned,
    };
    saveDoc(doc); // add new, or override a seed/created doc by id
    router.push('/admin/docs');
  };

  const fmtSel = 'rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Getting started with HevaSEO" className={`${fmtSel} w-full text-base font-semibold`} autoFocus />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</label>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One line shown on the doc card" className={`${fmtSel} w-full`} />
      </div>

      {/* Distribution — the key control */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary"><i className="ph-bold ph-paper-plane-tilt" />Distribute to</p>
        <div className="flex flex-wrap gap-1.5">
          {DISTRIBUTABLE_AUDIENCES.map((a) => {
            const m = audienceMeta(a);
            const on = audiences.includes(a);
            return (
              <button key={a} type="button" onClick={() => toggleAudience(a)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${on ? 'text-white' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}
                style={on ? { backgroundColor: m.color, borderColor: m.color } : undefined}>
                <i className={`ph-bold ${on ? 'ph-check-circle' : m.icon}`} aria-hidden /> {m.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{audiences.length === 0 ? 'Pick at least one audience.' : `This doc will appear for: ${audiences.map((a) => audienceMeta(a).label).join(', ')}.`}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as DocFormat)} className={`${fmtSel} w-full`}>
            {(Object.keys(FORMAT_META) as DocFormat[]).map((f) => <option key={f} value={f}>{FORMAT_META[f].label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="onboarding, tips" className={`${fmtSel} w-full`} />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Body</label>
          <span className="text-[11px] text-muted-foreground">Headings, images &amp; video — paste or use the toolbar</span>
        </div>
        <RichTextEditor
          initialHtml={bodyHtml}
          onChange={setBodyHtml}
          placeholder="Write the doc… add headings, upload an image, or embed a YouTube/Vimeo video."
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-primary" />
        Pin to the top of the audience’s docs list
      </label>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <button onClick={() => router.push('/admin/docs')} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-accent">Cancel</button>
        <button onClick={save} disabled={!canSave} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
          <i className="ph-bold ph-paper-plane-tilt" /> {existing ? 'Save changes' : 'Publish doc'}
        </button>
      </div>
    </div>
  );
}
