/* eslint-disable @next/next/no-img-element -- user Storage URLs, dynamic host */
'use client';

import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from './Toast';
import type { RevisionAttachment } from '@/app/(portal)/order.actions';

const MAX = 30 * 1024 * 1024; // 30 MB
const isMedia = (t: string) => t.startsWith('image/') || t.startsWith('video/');

/** Revision note editor: a written note (required) plus pasted / dropped / attached images & videos.
 *  Media uploads to the 'order-media' bucket; the composer returns the note + attachment URLs. */
export function RevisionComposer({ onSubmit, onCancel, busy }: { onSubmit: (note: string, atts: RevisionAttachment[]) => void; onCancel: () => void; busy?: boolean }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [atts, setAtts] = useState<RevisionAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadOne = async (file: File) => {
    if (!isMedia(file.type)) { toast(`${file.name}: only images or videos`, 'error'); return; }
    if (file.size > MAX) { toast(`${file.name}: must be under 30 MB`, 'error'); return; }
    setUploading((n) => n + 1);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast('Not signed in', 'error'); return; }
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const path = `${user.id}/rev-${Date.now()}-${Math.round(Math.random() * 1e4)}.${ext}`;
      const up = await supabase.storage.from('order-media').upload(path, file, { contentType: file.type });
      if (up.error) { toast(up.error.message, 'error'); return; }
      const { data: { publicUrl } } = supabase.storage.from('order-media').getPublicUrl(path);
      setAtts((a) => [...a, { kind: file.type.startsWith('video/') ? 'video' : 'image', url: publicUrl, name: file.name }]);
    } finally {
      setUploading((n) => n - 1);
    }
  };
  const handleFiles = (files: FileList | File[]) => Array.from(files).forEach((f) => void uploadOne(f));
  const onPaste = (e: ClipboardEvent) => { if (e.clipboardData.files.length) { e.preventDefault(); handleFiles(e.clipboardData.files); } };
  const onDrop = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); };

  const canSend = note.trim().length > 0 && uploading === 0 && !busy;
  return (
    <div onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()} className="space-y-3">
      <textarea
        value={note} onChange={(e) => setNote(e.target.value)} rows={4} autoFocus
        placeholder="What needs revising? Paste or drop screenshots / a short video to show the issue…"
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      {(atts.length > 0 || uploading > 0) && (
        <div className="flex flex-wrap gap-2">
          {atts.map((a, i) => (
            <span key={i} className="group relative block overflow-hidden rounded-lg border border-border">
              {a.kind === 'video'
                ? <video src={a.url} className="h-20 w-28 object-cover" muted playsInline />
                : <img src={a.url} alt={a.name} className="h-20 w-28 object-cover" />}
              {a.kind === 'video' && <span className="pointer-events-none absolute inset-0 grid place-items-center text-white/90"><i className="ph-fill ph-play-circle text-2xl" aria-hidden /></span>}
              <button type="button" onClick={() => setAtts((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${a.name}`} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"><i className="ph-bold ph-x text-[10px]" aria-hidden /></button>
            </span>
          ))}
          {uploading > 0 && <span className="grid h-20 w-28 place-items-center rounded-lg border border-dashed border-border text-muted-foreground"><i className="ph-bold ph-circle-notch animate-spin" aria-hidden /></span>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent"><i className="ph-bold ph-paperclip" aria-hidden /> Attach media</button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
          <button type="button" disabled={!canSend} onClick={() => onSubmit(note.trim(), atts)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"><i className="ph-bold ph-arrow-u-up-left" aria-hidden /> {busy ? 'Sending…' : 'Send for revision'}</button>
        </div>
      </div>
    </div>
  );
}
