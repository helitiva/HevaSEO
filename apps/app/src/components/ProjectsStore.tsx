'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { type Project } from '@/data/mock';
import { UUID_RE } from '@/lib/orderMap';
import {
  createProjectAction, updateProjectAction, deleteProjectAction,
  createFolderAction, updateFolderAction, deleteFolderAction,
  type MutResult,
} from '@/app/(portal)/projects.actions';

export type Folder = { id: string; name: string; color: string; parentId: string | null };

type ProjectsCtx = {
  projects: Project[];
  folders: Folder[];
  addProject: (p: Project) => Promise<MutResult>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<MutResult>;
  removeProject: (id: string) => Promise<MutResult>;
  addFolder: (f: Folder) => Promise<MutResult>;
  updateFolder: (id: string, patch: Partial<Folder>) => Promise<MutResult>;
  removeFolder: (id: string) => Promise<MutResult>;
};

const Ctx = createContext<ProjectsCtx | null>(null);
const folderId = (v: string | null | undefined) => (v && UUID_RE.test(v) ? v : null);

/** Shared, DB-backed projects + folders. Reads are the real RLS-scoped rows (passed from the layout);
 *  every mutation persists via a server action and re-fetches so /projects, the project detail page and
 *  the order form's project picker all reflect the same durable state. */
export function ProjectsProvider({ children, initialProjects = [], initialFolders = [] }: { children: ReactNode; initialProjects?: Project[]; initialFolders?: Folder[] }) {
  const router = useRouter();

  const value = useMemo<ProjectsCtx>(() => {
    // run the mutation, re-fetch on success, and hand the result back so callers can surface errors.
    const run = (p: Promise<MutResult>): Promise<MutResult> => p.then((r) => { if (r.ok) router.refresh(); return r; });
    return {
      projects: initialProjects,
      folders: initialFolders,
      addProject: (p) => run(createProjectAction({ name: p.name, domain: p.domain, folderId: folderId(p.folder), status: p.status, note: p.note })),
      updateProject: (id, patch) => run(updateProjectAction(id, {
        name: patch.name, domain: patch.domain, status: patch.status, note: patch.note,
        ...(patch.folder !== undefined ? { folderId: folderId(patch.folder) } : {}),
      })),
      removeProject: (id) => run(deleteProjectAction(id)),
      addFolder: (f) => run(createFolderAction({ name: f.name, color: f.color, parentId: folderId(f.parentId) })),
      updateFolder: (id, patch) => run(updateFolderAction(id, { name: patch.name, color: patch.color, parentId: patch.parentId })),
      removeFolder: (id) => run(deleteFolderAction(id)),
    };
  }, [initialProjects, initialFolders, router]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjects() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useProjects must be used within ProjectsProvider');
  return c;
}
