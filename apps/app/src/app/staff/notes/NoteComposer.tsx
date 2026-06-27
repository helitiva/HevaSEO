'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NoteModal } from './NoteModal';
import { RichTextEditor } from './RichTextEditor';
import { sanitizeHtml, htmlIsEmpty } from '@/lib/sanitizeHtml';
import {
  NOTE_CATEGORIES, NOTE_COLORS, youtubeId, youtubeThumb, newAttachmentId,
  type StaffNote, type NoteAttachment, type NoteColor,
} from '@/data/staffNotes';

export type Draft = Pick<StaffNote, 'title' | 'body' | 'category' | 'labels' | 'attachments' | 'color'>;

export const emptyDraft = (): Draft => ({ title: '', body: '', category: NOTE_CATEGORIES[0], labels: [], attachments: [], color: 'default' });

export function draftFrom(note: StaffNote | null): Draft {
  if (!note) return emptyDraft();
  return { title: note.title, body: note.body, category: note.category, labels: [...note.labels], attachments: [...note.attachments], color: note.color };
}

// A draft is saveable once it has a title or some body content.
export const canSaveDraft = (d: Draft): boolean => d.title.trim().length > 0 || !htmlIsEmpty(d.body);

// Normalise a draft for persistence (trim + sanitize the editor HTML at the boundary).
export const cleanDraft = (d: Draft): Draft => ({
  ...d,
  title: d.title.trim(),
  body: sanitizeHtml(d.body),
  category: d.category.trim() || NOTE_CATEGORIES[0],
});

interface Props {
  open: boolean;
  note: StaffNote | null; // null = create
  onClose: () => void;
  onSave: (draft: Draft) => void;
}

export function NoteComposer({ open, note, onClose, onSave }: Props) {
  return (
    <NoteModal open={open} onClose={onClose} ariaLabel={note ? 'Edit note' : 'New note'} widthClass="max-w-4xl">
      <ComposerForm key={note?.id ?? 'new'} note={note} onClose={onClose} onSave={onSave} />
    </NoteModal>
  );
}

function ComposerForm({ note, onClose, onSave }: Omit<Props, 'open'>) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(note));
  const canSave = canSaveDraft(draft);

  const save = () => { if (canSave) onSave(cleanDraft(draft)); };
  // Expand the current edit into the full-page editor (docs-style). Existing note → its edit route;
  // a brand-new note → the blank full-page editor.
  const expand = () => { onClose(); router.push(note ? `/staff/notes/${note.id}/edit` : '/staff/notes/new'); };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="display flex items-center gap-2 text-lg font-bold">
          <i className={`ph-bold ${note ? 'ph-pencil-simple' : 'ph-note-pencil'} text-primary`} aria-hidden />
          {note ? 'Edit note' : 'New note'}
        </h2>
        <div className="flex items-center gap-1.5">
          <button onClick={expand} title="Open as full page" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold transition hover:bg-accent">
            <i className="ph-bold ph-arrows-out-simple" aria-hidden /> Full page
          </button>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-x" aria-hidden /></button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="scrollbar-thin max-h-[78vh] overflow-y-auto p-5">
        <NoteFormBody draft={draft} setDraft={setDraft} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-border p-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <i className="ph-bold ph-check" aria-hidden /> {note ? 'Save changes' : 'Create note'}
        </button>
      </div>
    </>
  );
}

// The shared form fields — reused by the modal composer and the full-page editor.
export function NoteFormBody({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  const [labelInput, setLabelInput] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function addLabel() {
    const v = labelInput.trim().replace(/^#/, '');
    if (!v || draft.labels.includes(v)) { setLabelInput(''); return; }
    set('labels', [...draft.labels, v]);
    setLabelInput('');
  }
  const removeLabel = (l: string) => set('labels', draft.labels.filter((x) => x !== l));
  const addAttachment = (a: NoteAttachment) => set('attachments', [...draft.attachments, a]);
  const removeAttachment = (id: string) => set('attachments', draft.attachments.filter((a) => a.id !== id));

  return (
    <div className="space-y-4">
      {/* Title */}
      <input
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
        placeholder="Note title"
        className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-lg font-semibold outline-none transition focus:border-primary"
      />

      {/* Rich editor */}
      <RichTextEditor initialHtml={draft.body} onChange={(html) => set('body', html)} />

      {/* Meta: category + color */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Category</span>
          <input
            list="note-categories"
            value={draft.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary"
          />
          <datalist id="note-categories">
            {NOTE_CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Colour</span>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {(Object.keys(NOTE_COLORS) as NoteColor[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={NOTE_COLORS[c].label}
                onClick={() => set('color', c)}
                className="h-7 w-7 rounded-full border-2 transition"
                style={{ backgroundColor: NOTE_COLORS[c].dot, borderColor: draft.color === c ? 'hsl(var(--foreground))' : 'transparent', transform: draft.color === c ? 'scale(1.1)' : undefined, opacity: draft.color === c ? 1 : 0.7 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Labels */}
      <div>
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Labels</span>
        {draft.labels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {draft.labels.map((l) => (
              <span key={l} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                #{l}
                <button type="button" onClick={() => removeLabel(l)} aria-label={`Remove ${l}`} className="text-muted-foreground hover:text-foreground">
                  <i className="ph-bold ph-x text-[10px]" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLabel(); } }}
            placeholder="Add a label, press Enter"
            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none transition focus:border-primary"
          />
          <button type="button" onClick={addLabel} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:bg-accent">Add</button>
        </div>
      </div>

      {/* Attachments */}
      <AttachmentEditor attachments={draft.attachments} onAdd={addAttachment} onRemove={removeAttachment} />
    </div>
  );
}

// ── Attachment builder: image (file/url), link, YouTube video ────────────────
type AddKind = 'image' | 'link' | 'video';

function AttachmentEditor({ attachments, onAdd, onRemove }: { attachments: NoteAttachment[]; onAdd: (a: NoteAttachment) => void; onRemove: (id: string) => void }) {
  const [kind, setKind] = useState<AddKind>('image');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const vid = useMemo(() => (kind === 'video' ? youtubeId(url) : null), [kind, url]);

  function reset() { setUrl(''); setLabel(''); setError(null); }

  function add() {
    const u = url.trim();
    if (kind === 'video') {
      if (!youtubeId(u)) { setError('Enter a valid YouTube URL'); return; }
    } else {
      try { new URL(u); } catch { setError('Enter a valid URL'); return; }
    }
    onAdd({ id: newAttachmentId(), kind, url: u, label: label.trim() || undefined });
    reset();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onAdd({ id: newAttachmentId(), kind: 'image', url: String(reader.result), label: file.name });
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">Attachments</span>

      {attachments.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
              <i className={`ph-bold ${ATT_ICON[a.kind]} text-primary`} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{a.label || a.url}</span>
              <button type="button" onClick={() => onRemove(a.id)} aria-label="Remove attachment" className="text-muted-foreground hover:text-rose-500">
                <i className="ph-bold ph-trash" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-border p-3">
        <div className="mb-2 inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
          {(['image', 'link', 'video'] as AddKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); reset(); }}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 capitalize transition ${kind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <i className={`ph-bold ${ATT_ICON[k]}`} aria-hidden /> {k === 'video' ? 'YouTube' : k}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            placeholder={kind === 'video' ? 'Paste a YouTube link…' : kind === 'image' ? 'Image URL (or upload below)' : 'https://…'}
            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none transition focus:border-primary"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none transition focus:border-primary"
          />

          {kind === 'video' && vid && (
            <div className="relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={youtubeThumb(vid)} alt="Video preview" className="h-32 w-full object-cover" />
              <span className="absolute inset-0 grid place-items-center"><i className="ph-fill ph-play-circle text-4xl text-white/90 drop-shadow" aria-hidden /></span>
            </div>
          )}

          {error && <p className="text-xs font-medium text-rose-500">{error}</p>}

          <div className="flex items-center gap-2">
            {kind === 'image' && (
              <>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:bg-accent">
                  <i className="ph-bold ph-upload-simple" aria-hidden /> Upload
                </button>
              </>
            )}
            <button
              type="button"
              onClick={add}
              disabled={!url.trim()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-40"
            >
              <i className="ph-bold ph-plus" aria-hidden /> Add attachment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ATT_ICON: Record<NoteAttachment['kind'], string> = {
  image: 'ph-image',
  video: 'ph-youtube-logo',
  link: 'ph-link-simple',
};
