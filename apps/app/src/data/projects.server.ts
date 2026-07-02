import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Project } from '@/data/mock';
import type { Folder } from '@/components/ProjectsStore';

// Real, RLS-scoped projects & folders for the signed-in customer. The DB stores the durable fields
// (name, domain, status, note, folder); the rich view-only bits (tags, "updated" label) are derived.
const FOLDER_FALLBACK_COLOR = '#64748b';

type FolderRow = { id: string; name: string; color: string | null; parent_id: string | null };
export async function getMyFolders(): Promise<Folder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('folders').select('id, name, color, parent_id').order('created_at', { ascending: true })
    .returns<FolderRow[]>();
  if (error) throw new Error(`getMyFolders: ${error.message}`);
  return (data ?? []).map((f) => ({ id: f.id, name: f.name, color: f.color ?? FOLDER_FALLBACK_COLOR, parentId: f.parent_id }));
}

type ProjectRow = {
  id: string; name: string; domain: string | null; status: string | null; note: string | null;
  created_at: string; folder_id: string | null; archived: boolean | null; folder: { name: string | null } | null;
};
const rel = (ts: string): string => {
  const days = Math.round((Date.now() - new Date(ts).getTime()) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};
export async function getMyProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, domain, status, note, created_at, folder_id, archived, folder:folders!projects_folder_id_fkey(name)')
    .order('created_at', { ascending: false })
    .returns<ProjectRow[]>();
  if (error) throw new Error(`getMyProjects: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    domain: p.domain ?? '',
    label: p.folder?.name ?? '',   // display name (chip)
    folder: p.folder_id ?? '',     // folder id — what the rail/filters match on
    status: (p.status === 'progress' || p.status === 'completed' ? p.status : 'planned'),
    note: p.note ?? '',
    updated: rel(p.created_at),
    archived: p.archived ?? false,
    tags: {},
  }));
}
