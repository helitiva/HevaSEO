'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { PROJECTS, FOLDERS, type Project } from '@/data/mock';

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

/** Shared projects + folders so /projects, the project detail page, and the order
 *  form's project picker all see the same session edits. */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [extraProjects, setExtraProjects] = useState<Project[]>([]);
  const [projectOverrides, setProjectOverrides] = useState<Record<string, Partial<Project>>>({});
  const [removedProjects, setRemovedProjects] = useState<Set<string>>(new Set());
  const [extraFolders, setExtraFolders] = useState<Folder[]>([]);
  const [folderOverrides, setFolderOverrides] = useState<Record<string, Partial<Folder>>>({});
  const [removedFolders, setRemovedFolders] = useState<Set<string>>(new Set());

  const value = useMemo<ProjectsCtx>(() => {
    const projects = [...extraProjects, ...PROJECTS]
      .filter((p) => !removedProjects.has(p.id))
      .map((p) => (projectOverrides[p.id] ? { ...p, ...projectOverrides[p.id] } : p));
    const folders: Folder[] = [...FOLDERS, ...extraFolders]
      .filter((f) => !removedFolders.has(f.id))
      .map((f) => (folderOverrides[f.id] ? { ...f, ...folderOverrides[f.id] } : f));
    return {
      projects,
      folders,
      addProject: (p) => setExtraProjects((prev) => [p, ...prev]),
      updateProject: (id, patch) => setProjectOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
      removeProject: (id) => setRemovedProjects((prev) => new Set(prev).add(id)),
      addFolder: (f) => setExtraFolders((prev) => [...prev, f]),
      updateFolder: (id, patch) => setFolderOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
      removeFolder: (id) => setRemovedFolders((prev) => {
        const n = new Set(prev).add(id);
        for (const f of folders) if (f.parentId === id) n.add(f.id); // cascade child folders
        return n;
      }),
    };
  }, [extraProjects, projectOverrides, removedProjects, extraFolders, folderOverrides, removedFolders]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjects() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useProjects must be used within ProjectsProvider');
  return c;
}
