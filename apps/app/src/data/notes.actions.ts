'use server';

import { createClient } from '@/lib/supabase/server';
import type { StaffNote, NoteAttachment, NoteColor } from '@/data/staffNotes';
import type { Json } from '@/lib/supabase/database.types';

// Real, owner-scoped notebook (replaces the localStorage store). The durable rich fields live in the
// notes.body jsonb ({ html, category, labels, pinned, attachments }); title/color/surface are columns.
type NoteRow = { id: string; title: string | null; body: Json; color: string | null; created_at: string; updated_at: string };

function toNote(r: NoteRow): StaffNote {
  const b = (r.body && typeof r.body === 'object' && !Array.isArray(r.body) ? r.body : {}) as Record<string, unknown>;
  return {
    id: r.id,
    title: r.title ?? '',
    body: typeof b.html === 'string' ? b.html : '',
    category: typeof b.category === 'string' ? b.category : 'Personal',
    labels: Array.isArray(b.labels) ? (b.labels as string[]) : [],
    attachments: Array.isArray(b.attachments) ? (b.attachments as NoteAttachment[]) : [],
    color: (r.color ?? 'default') as NoteColor,
    pinned: Boolean(b.pinned),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getMyNotesAction(surface: string): Promise<StaffNote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notes').select('id, title, body, color, created_at, updated_at').eq('surface', surface)
    .order('updated_at', { ascending: false }).returns<NoteRow[]>();
  // Was `if (error) return []` — a read failure rendered "Your notebook is empty" / "Note not found",
  // which is the same screen as having no notes. Losing sight of your own writing should never look
  // identical to never having written any.
  if (error) throw new Error(`getMyNotesAction: ${error.message}`);
  return (data ?? []).map(toNote);
}

export type NoteMutResult = { ok: true; note: StaffNote } | { ok: false; error: string };
export async function upsertNoteAction(surface: string, note: StaffNote): Promise<NoteMutResult> {
  const supabase = await createClient();
  const body: Json = { html: note.body, category: note.category, labels: note.labels, pinned: note.pinned, attachments: note.attachments as unknown as Json };
  const { data, error } = await supabase.rpc('upsert_note', {
    p_id: note.id, p_surface: surface, p_title: note.title, p_body: body, p_color: note.color,
  }).returns<NoteRow>();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save the note.' };
  return { ok: true, note: toNote(data) };
}

export async function deleteNoteAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_note', { p_id: id });
  return error ? { ok: false, error: error.message } : { ok: true };
}
