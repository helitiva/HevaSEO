'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { composerToDb } from '@/lib/docAudienceMap';
import type { DocAudience, DocFormat } from '@/data/staffDocs';

export type DocResult = { ok: true; id: string } | { ok: false; error: string };
export type DeleteResult = { ok: true } | { ok: false; error: string };

export type SaveDocInput = {
  id?: string | null;
  title: string;
  summary: string;
  format: DocFormat;
  tags: string[];
  pinned: boolean;
  html: string;          // already allowlist-sanitized client-side at the composer boundary
  readMins: number;
  audiences: DocAudience[];
};

const ERR: Record<string, string> = {
  NOT_ADMIN: 'Only an admin can publish docs.',
  INVALID_TITLE: 'Give the doc a title.',
  NO_AUDIENCE: 'Pick at least one audience.',
  INVALID_AUDIENCE: 'Pick a valid audience.',
  DOC_NOT_FOUND: 'That doc no longer exists.',
};

// Lane C inc-C3 — admin publishes/edits a doc, gác③ (RLS). upsert_doc is admin-gated + claims-derived
// (tenant + author from the JWT); the docs table is SELECT-only via RLS so the write goes through the fn.
// The composer's audience model (role + skill tags) is split into the DB's audiences[]/required_skills[].
export async function saveDocAction(input: SaveDocInput): Promise<DocResult> {
  if (!input.title.trim()) return { ok: false, error: 'Give the doc a title.' };
  if (input.audiences.length === 0) return { ok: false, error: 'Pick at least one audience.' };
  const { audiences, requiredSkills } = composerToDb(input.audiences);
  const body = {
    summary: input.summary.trim() || input.title.trim(),
    format: input.format,
    tags: input.tags,
    author: 'Admin',
    readMins: input.readMins,
    blocks: [] as never[],
    html: input.html,
    resources: [] as never[],
  };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('upsert_doc', {
    p_title: input.title.trim(), p_body: body, p_audiences: audiences,
    p_required_skills: requiredSkills, p_pinned: input.pinned,
    ...(input.id ? { p_id: input.id } : {}), // omit for new → fn default null → insert
  }).select('id').single();
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/admin/docs');
  revalidatePath('/docs'); revalidatePath('/staff/docs'); revalidatePath('/manager/docs');
  return { ok: true, id: (data as { id: string }).id };
}

export async function deleteDocAction(id: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_doc', { p_id: id });
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/admin/docs');
  revalidatePath('/docs'); revalidatePath('/staff/docs'); revalidatePath('/manager/docs');
  return { ok: true };
}
