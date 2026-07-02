'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { type Project } from '@/data/mock';
import { UUID_RE } from '@/lib/orderMap';
import {
  createProjectAction, updateProjectAction, deleteProjectAction,
  createFolderAction, updateFolderAction, deleteFolderAction,
} from '@/app/(portal)/projects.actions';

export type Folder = { id: string; name: string; color: string; parentId: string | null };

type ProjectsCtx = {
  projects: Project[];
  folders: Folder[];
  addProject: (p: Project) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  addFolder: (f: Folder) => void;
  updateFolder: (id: string, patch: Partial<Folder>) => void;
  removeFolder: (id: string) => void;
};

const Ctx = createContext<ProjectsCtx | null>(null);
const folderId = (v: string | null | undefined) => (v && UUID_RE.test(v) ? v : null);

/** Shared, DB-backed projects + folders. Reads are the real RLS-scoped rows (passed from the layout);
 *  every mutation persists via a server action and re-fetches so /projects, the project detail page and
 *  the order form's project picker all reflect the same durable state. */
export function ProjectsProvider({ children, initialProjects = [], initialFolders = [] }: { children: ReactNode; initialProjects?: Project[]; initialFolders?: Folder[] }) {
  const router = useRouter();

  const value = useMemo<ProjectsCtx>(() => {
    const after = (p: Promise<{ ok: boolean }>) => { void p.then((r) => { if (r.ok) router.refresh(); }); };
    return {
      projects: initialProjects,
      folders: initialFolders,
      addProject: (p) => after(createProjectAction({ name: p.name, domain: p.domain, folderId: folderId(p.folder), status: p.status, note: p.note })),
      updateProject: (id, patch) => after(updateProjectAction(id, {
        name: patch.name, domain: patch.domain, status: patch.status, note: patch.note,
        ...(patch.folder !== undefined ? { folderId: folderId(patch.folder) } : {}),
      })),
      removeProject: (id) => after(deleteProjectAction(id)),
      addFolder: (f) => after(createFolderAction({ name: f.name, color: f.color, parentId: folderId(f.parentId) })),
      updateFolder: (id, patch) => after(updateFolderAction(id, { name: patch.name, color: patch.color, parentId: patch.parentId })),
      removeFolder: (id) => after(deleteFolderAction(id)),
    };
  }, [initialProjects, initialFolders, router]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjects() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useProjects must be used within ProjectsProvider');
  return c;
}
