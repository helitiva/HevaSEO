'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Customer-owned Projects & Folders CRUD. Writes go through the caller's session (RLS enforces
// ownership); the customer's own id + tenant are resolved from their customer row.
export type MutResult = { ok: true; id?: string } | { ok: false; error: string };

async function owner() {
  const supabase = await createClient();
  const { data: cust, error } = await supabase.from('customers').select('id, tenant_id').maybeSingle();
  if (error || !cust) return null;
  return { supabase, customerId: cust.id as string, tenantId: cust.tenant_id as string };
}
function revalidate() {
  revalidatePath('/projects');
  revalidatePath('/dashboard');
  revalidatePath('/orders');
}

export async function createFolderAction(input: { name: string; color?: string | null; parentId?: string | null }): Promise<MutResult> {
  const o = await owner();
  if (!o) return { ok: false, error: 'No customer profile.' };
  const { data, error } = await o.supabase.from('folders')
    .insert({ tenant_id: o.tenantId, customer_id: o.customerId, name: input.name.trim(), color: input.color ?? null, parent_id: input.parentId ?? null })
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateFolderAction(id: string, patch: { name?: string; color?: string | null; parentId?: string | null }): Promise<MutResult> {
  const o = await owner();
  if (!o) return { ok: false, error: 'No customer profile.' };
  const { error } = await o.supabase.from('folders').update({
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
    ...(patch.parentId !== undefined ? { parent_id: patch.parentId } : {}),
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteFolderAction(id: string): Promise<MutResult> {
  const o = await owner();
  if (!o) return { ok: false, error: 'No customer profile.' };
  // detach any projects in this folder first (folder_id has no ON DELETE SET NULL); child folders
  // auto-detach via parent_id ON DELETE SET NULL.
  await o.supabase.from('projects').update({ folder_id: null }).eq('folder_id', id);
  const { error } = await o.supabase.from('folders').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function createProjectAction(input: { name: string; domain?: string; folderId?: string | null; status?: string; note?: string }): Promise<MutResult> {
  const o = await owner();
  if (!o) return { ok: false, error: 'No customer profile.' };
  const { data, error } = await o.supabase.from('projects')
    .insert({ tenant_id: o.tenantId, customer_id: o.customerId, name: input.name.trim(), domain: input.domain ?? null, folder_id: input.folderId ?? null, status: input.status ?? 'planned', note: input.note ?? null })
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateProjectAction(id: string, patch: { name?: string; domain?: string; folderId?: string | null; status?: string; note?: string; archived?: boolean }): Promise<MutResult> {
  const o = await owner();
  if (!o) return { ok: false, error: 'No customer profile.' };
  const { error } = await o.supabase.from('projects').update({
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.domain !== undefined ? { domain: patch.domain } : {}),
    ...(patch.folderId !== undefined ? { folder_id: patch.folderId } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** "Move to Archive" a folder: archive its projects (detached from the folder) and remove the folder. */
export async function archiveFolderAction(id: string): Promise<MutResult> {
  const o = await owner();
  if (!o) return { ok: false, error: 'No customer profile.' };
  const arch = await o.supabase.from('projects').update({ archived: true, folder_id: null }).eq('folder_id', id);
  if (arch.error) return { ok: false, error: arch.error.message };
  const { error } = await o.supabase.from('folders').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteProjectAction(id: string): Promise<MutResult> {
  const o = await owner();
  if (!o) return { ok: false, error: 'No customer profile.' };
  // Confirm ownership (RLS-scoped) before any service-role writes below.
  const { data: own } = await o.supabase.from('projects').select('id').eq('id', id).maybeSingle();
  if (!own) return { ok: false, error: 'Project not found.' };

  // The order_details.project_id FK is ON DELETE SET NULL, so deleting would orphan this project's orders
  // off /projects (they'd keep the text name but no live link). Reassign them to an "Uncategorized" catch-all
  // project first so the customer never loses sight of them. Empty projects delete straight through.
  // order_details is update-locked for both authenticated and service_role, so the move goes through the
  // ownership-checked SECURITY DEFINER fn reassign_project_orders.
  const { data: linked } = await o.supabase.from('order_details').select('id').eq('project_id', id).limit(1);
  if (linked?.length) {
    const { data: ex } = await o.supabase.from('projects').select('id').eq('name', 'Uncategorized').neq('id', id).limit(1);
    let uncatId = ex?.[0]?.id ?? null;
    if (!uncatId) {
      const { data: np } = await o.supabase.from('projects')
        .insert({ tenant_id: o.tenantId, customer_id: o.customerId, name: 'Uncategorized', status: 'planned' })
        .select('id').single();
      uncatId = np?.id ?? null;
    }
    if (uncatId) {
      const { error: reErr } = await o.supabase.rpc('reassign_project_orders', { p_from: id, p_to: uncatId });
      if (reErr) return { ok: false, error: reErr.message };
    }
  }

  const { error } = await o.supabase.from('projects').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
