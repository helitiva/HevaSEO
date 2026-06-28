'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SERVICES, type ServiceKey, type Project } from '@/data/mock';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { useProjects, type Folder } from '@/components/ProjectsStore';
import { NewProjectModal, type ProjectInput } from '@/components/NewProjectModal';
import { NewFolderModal, type FolderInput } from '@/components/NewFolderModal';

/** Gear menu on each project card — edit / open / delete. */
function ProjectMenu({ project, onEdit, onDelete }: { project: Project; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const item = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-muted';
  return (
    <span className="relative ml-auto" onClick={stop}>
      <button type="button" aria-label="Project settings" title="Project settings" onClick={(e) => { stop(e); setOpen((v) => !v); }} className="card-gear">
        <i className="ph-bold ph-gear-six" aria-hidden />
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={(e) => { stop(e); setOpen(false); }} />
          <span className="absolute right-0 z-50 mt-1 block w-44 rounded-xl border border-border bg-card p-1 shadow-xl">
            <button type="button" onClick={(e) => { stop(e); setOpen(false); onEdit(); }} className={item}><i className="ph-bold ph-pencil-simple text-muted-foreground" aria-hidden /> Edit project</button>
            <button type="button" onClick={(e) => { stop(e); setOpen(false); router.push(`/projects/${project.id}`); }} className={item}><i className="ph-bold ph-arrow-square-out text-muted-foreground" aria-hidden /> Open</button>
            <button type="button" onClick={(e) => { stop(e); setOpen(false); onDelete(); }} className={`${item} text-destructive hover:bg-destructive/10`}><i className="ph-bold ph-trash" aria-hidden /> Delete</button>
          </span>
        </>
      )}
    </span>
  );
}

/** Gear menu on each folder row — edit / delete. */
function FolderMenu({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const item = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-muted';
  return (
    <span className="relative shrink-0" onClick={stop}>
      <button
        type="button"
        aria-label={`Folder settings: ${label}`}
        onClick={(e) => { stop(e); setOpen((v) => !v); }}
        className={`grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <i className="ph-bold ph-gear-six text-[13px]" aria-hidden />
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={(e) => { stop(e); setOpen(false); }} />
          <span className="absolute right-0 z-50 mt-1 block w-40 rounded-xl border border-border bg-card p-1 shadow-xl">
            <button type="button" onClick={(e) => { stop(e); setOpen(false); onEdit(); }} className={item}><i className="ph-bold ph-pencil-simple text-muted-foreground" aria-hidden /> Edit folder</button>
            <button type="button" onClick={(e) => { stop(e); setOpen(false); onDelete(); }} className={`${item} text-destructive hover:bg-destructive/10`}><i className="ph-bold ph-trash" aria-hidden /> Delete</button>
          </span>
        </>
      )}
    </span>
  );
}

const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
function favColor(domain: string) {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function initials(domain: string) {
  const name = domain.replace(/\.(com|net|org|io|vn)$/i, '');
  const parts = name.split(/[.\-]/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase();
}

const STATUS_PILL: Record<Project['status'], { label: string; color: string }> = {
  planned: { label: 'Planning', color: '#94a3b8' },
  progress: { label: 'In progress', color: '#2563eb' },
  completed: { label: 'Completed', color: '#10b981' },
};

function ProjectsInner() {
  const focusDomain = useSearchParams().get('p');
  const toast = useToast();
  const [folder, setFolder] = useState<string>('all');
  const [search, setSearch] = useState(focusDomain ?? '');
  const [status, setStatus] = useState<string>('all');
  const [svc, setSvc] = useState<string>('all');

  // Shared store — edits/creates/deletes here also show on the project detail page & order form.
  const { projects: allProjects, folders: allFolders, addProject, updateProject, removeProject, addFolder, updateFolder, removeFolder: removeFolderFromStore } = useProjects();
  const [modal, setModal] = useState<null | 'project' | 'folder'>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editFolderTarget, setEditFolderTarget] = useState<Folder | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const folderName = (id: string) => allFolders.find((f) => f.id === id)?.name;
  const folderColor = (id: string) => allFolders.find((f) => f.id === id)?.color ?? '#94a3b8';

  const createFolder = (f: FolderInput) => { addFolder(f); toast(`Folder “${f.name}” created`); };
  const createProject = (p: ProjectInput) => {
    const proj: Project = {
      id: `p-${Date.now().toString(36)}`,
      name: p.name,
      domain: p.domain,
      label: folderName(p.folderId) ?? 'Uncategorized',
      folder: p.folderId,
      status: p.status,
      note: p.note,
      updated: 'Just now',
      tags: {},
    };
    addProject(proj);
    setFolder('all');
    toast(`Project ${proj.domain} created`);
  };
  const saveEdit = (p: ProjectInput) => {
    if (!editTarget) return;
    updateProject(editTarget.id, { name: p.name, domain: p.domain, label: folderName(p.folderId) ?? 'Uncategorized', folder: p.folderId, status: p.status, note: p.note, updated: 'Just now' });
    toast(`Project ${p.domain} updated`);
  };
  const deleteProject = (p: Project) => { removeProject(p.id); toast(`Project ${p.domain} deleted`, 'info'); };
  const saveFolderEdit = (f: FolderInput) => {
    if (!editFolderTarget) return;
    updateFolder(editFolderTarget.id, { name: f.name, color: f.color, parentId: f.parentId });
    toast(`Folder “${f.name}” updated`);
  };
  const removeFolder = (f: Folder) => {
    const childIds = allFolders.filter((c) => c.parentId === f.id).map((c) => c.id);
    if (folder === f.id || childIds.includes(folder)) setFolder('all');
    removeFolderFromStore(f.id);
    toast(`Folder “${f.name}” deleted`, 'info');
  };
  const moveProjectToFolder = (projectId: string, folderId: string) => {
    const p = allProjects.find((x) => x.id === projectId);
    if (!p || p.folder === folderId) return;
    updateProject(projectId, { folder: folderId, label: folderName(folderId) ?? 'Uncategorized' });
    toast(`Moved ${p.domain} → ${folderName(folderId)}`);
  };

  // Focus the project opened from an order card link (/projects?p=<domain>).
  useEffect(() => {
    if (focusDomain) {
      setSearch(focusDomain);
      setFolder('all');
      setStatus('all');
      setSvc('all');
    }
  }, [focusDomain]);

  const filtered = useMemo(
    () =>
      allProjects.filter((p) => {
        if (folder !== 'all' && p.folder !== folder) return false;
        if (search && !p.domain.toLowerCase().includes(search.toLowerCase())) return false;
        if (status !== 'all' && p.status !== status) return false;
        if (svc !== 'all' && !(svc in p.tags)) return false;
        return true;
      }),
    [allProjects, folder, search, status, svc]
  );

  const countFor = (id: string) => (id === 'all' ? allProjects.length : allProjects.filter((p) => p.folder === id).length);
  const roots = allFolders.filter((f) => !f.parentId);
  const childrenOf = (id: string) => allFolders.filter((f) => f.parentId === id);

  const FolderRow = ({ id, name, color, depth = 0 }: { id: string; name: string; color?: string; depth?: number }) => (
    <div
      className={`folder-item group w-full${folder === id ? ' active' : ''}${dragOverFolder === id ? ' drop-hot' : ''}`}
      style={{ paddingLeft: `${0.6 + depth * 0.85}rem` }}
      onDragOver={id === 'all' ? undefined : (e) => { e.preventDefault(); setDragOverFolder(id); }}
      onDragLeave={() => setDragOverFolder((d) => (d === id ? null : d))}
      onDrop={id === 'all' ? undefined : (e) => { e.preventDefault(); setDragOverFolder(null); const pid = e.dataTransfer.getData('text/plain'); if (pid) moveProjectToFolder(pid, id); }}
    >
      <button type="button" onClick={() => setFolder(id)} className="flex min-w-0 flex-1 items-center gap-[.55rem] text-left">
        <i className="ph-bold ph-folder shrink-0" style={{ color: color ?? 'currentColor' }} aria-hidden />
        <span className="truncate">{name}</span>
      </button>
      {id !== 'all' && (
        <FolderMenu
          label={name}
          onEdit={() => { const f = allFolders.find((x) => x.id === id); if (f) setEditFolderTarget(f); }}
          onDelete={() => { const f = allFolders.find((x) => x.id === id); if (f) setDeleteFolderTarget(f); }}
        />
      )}
      <span className="folder-count">{countFor(id)}</span>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Projects</h1>
            <span className="pill pill-good">{allProjects.length} projects</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Organize websites into folders · track campaigns & overall status</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModal('folder')} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold transition hover:bg-accent"><i className="ph-bold ph-folder-plus" aria-hidden /> Folder</button>
          <button onClick={() => setModal('project')} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-px hover:bg-primary/90 active:scale-[.98]"><i className="ph-bold ph-plus" aria-hidden /> New project</button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5 lg:flex-row">
        {/* folder rail */}
        <aside className="w-full shrink-0 lg:w-60">
          <div className="rounded-2xl border border-border bg-card/70 p-2.5 backdrop-blur">
            <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Folders</p>
            <div className="space-y-0.5">
              <FolderRow id="all" name="All projects" />
              {roots.map((f) => (
                <div key={f.id} className="space-y-0.5">
                  <FolderRow id={f.id} name={f.name} color={f.color} />
                  {childrenOf(f.id).map((c) => (
                    <FolderRow key={c.id} id={c.id} name={c.name} color={c.color} depth={1} />
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-2 px-2 text-[10px] leading-relaxed text-muted-foreground">
              <i className="ph-bold ph-folders" aria-hidden /> Group your websites into folders to track campaigns by client.
            </p>
          </div>
        </aside>

        {/* content */}
        <section className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/70 p-3 backdrop-blur md:flex-row md:items-center">
            <div className="flex min-w-0 shrink items-center gap-2 text-sm">
              <i className="ph-bold ph-folder-open text-primary" aria-hidden />
              <span className="truncate font-semibold">{folder === 'all' ? 'All projects' : folderName(folder)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:ml-auto md:flex-nowrap md:shrink-0">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
                <i className="ph-bold ph-magnifying-glass text-muted-foreground" aria-hidden />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by domain…" className="w-28 bg-transparent outline-none placeholder:text-muted-foreground sm:w-40" />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none">
                <option value="all">All statuses</option>
                <option value="planned">Planning</option>
                <option value="progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
              <select value={svc} onChange={(e) => setSvc(e.target.value)} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none">
                <option value="all">All services</option>
                {(Object.keys(SERVICES) as ServiceKey[]).map((k) => <option key={k} value={k}>{SERVICES[k].label}</option>)}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            folder !== 'all' && !search && status === 'all' && svc === 'all' ? (
              <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl text-xl" style={{ background: `${folderColor(folder)}1a`, color: folderColor(folder) }}><i className="ph-bold ph-folder-open" aria-hidden /></span>
                <p className="mt-3 font-semibold">{folderName(folder)} is empty</p>
                <p className="mt-1 text-sm text-muted-foreground">Drag a project here, or create one in this folder.</p>
                <button onClick={() => setModal('project')} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-plus" aria-hidden /> New project</button>
              </div>
            ) : (
              <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground"><i className="ph-bold ph-folder-dashed text-xl" aria-hidden /></span>
                <p className="mt-3 font-semibold">No matching projects</p>
                <p className="mt-1 text-sm text-muted-foreground">Try adjusting the filters, or create a new project.</p>
              </div>
            )
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => {
                const sp = STATUS_PILL[p.status];
                const tags = Object.keys(p.tags) as ServiceKey[];
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)} className="pcard block" title="Drag to a folder to move it">
                    <div className="flex items-start gap-2.5">
                      <span className="fav" style={{ background: favColor(p.domain) }}>{initials(p.domain)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-sm font-semibold">{p.domain}</h3>
                          <ProjectMenu project={p} onEdit={() => setEditTarget(p)} onDelete={() => setDeleteTarget(p)} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="chip" style={{ background: `${folderColor(p.folder)}1a`, color: folderColor(p.folder) }}>
                            <i className="ph-bold ph-folder" aria-hidden /> {p.label}
                          </span>
                          <span className="pill" style={{ background: `${sp.color}1f`, color: sp.color }}>● {sp.label}</span>
                        </div>
                      </div>
                    </div>

                    <p className="note mt-3 flex gap-1.5 text-[12px] leading-snug text-muted-foreground">
                      <i className="ph-bold ph-note-pencil mt-px shrink-0" aria-hidden />
                      <span className="line-clamp-2">{p.note}</span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                      {tags.length === 0 ? (
                        <span className="text-[11px] italic text-muted-foreground/60">No services ordered yet</span>
                      ) : (
                        tags.map((k) => {
                          const s = p.tags[k]!;
                          return (
                            <span key={k} className="svc-tag" title={`${SERVICES[k].label} · ${s.plan} ordered · ${s.run} running · ${s.done} completed`}>
                              <i className={`ph-bold ${SERVICES[k].icon}`} />
                              {SERVICES[k].label}
                              <span className="n" style={{ color: '#94a3b8' }}>{s.plan}</span>
                              <span className="sep">|</span><span className="n" style={{ color: '#f59e0b' }}>{s.run}</span>
                              <span className="sep">|</span><span className="n" style={{ color: '#10b981' }}>{s.done}</span>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {modal === 'project' && (
        <NewProjectModal
          onClose={() => setModal(null)}
          folders={allFolders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))}
          onCreate={createProject}
        />
      )}
      {modal === 'folder' && (
        <NewFolderModal
          onClose={() => setModal(null)}
          rootFolders={roots.map((f) => ({ id: f.id, name: f.name }))}
          onCreate={createFolder}
        />
      )}

      {editTarget && (
        <NewProjectModal
          onClose={() => setEditTarget(null)}
          folders={allFolders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))}
          onCreate={saveEdit}
          initial={{ name: editTarget.name, domain: editTarget.domain, folderId: editTarget.folder, status: editTarget.status, note: editTarget.note }}
          title="Edit project"
          subtitle="Update details, folder & status"
          submitLabel="Save changes"
          icon="ph-pencil-simple"
        />
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} title="Delete project" subtitle={deleteTarget.domain} icon="ph-trash">
          {({ close }) => (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Remove <b className="text-foreground">{deleteTarget.domain}</b> and stop tracking its campaigns? This can&apos;t be undone.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={close} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
                <button type="button" onClick={() => { deleteProject(deleteTarget); close(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-2 text-sm font-bold text-white transition hover:bg-destructive/90"><i className="ph-bold ph-trash" aria-hidden /> Delete project</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {editFolderTarget && (
        <NewFolderModal
          onClose={() => setEditFolderTarget(null)}
          rootFolders={roots.filter((f) => f.id !== editFolderTarget.id).map((f) => ({ id: f.id, name: f.name }))}
          onCreate={saveFolderEdit}
          initial={{ name: editFolderTarget.name, color: editFolderTarget.color, parentId: editFolderTarget.parentId }}
          title="Edit folder"
          subtitle="Rename, recolor or move it"
          submitLabel="Save changes"
          icon="ph-pencil-simple"
        />
      )}

      {deleteFolderTarget && (
        <Modal onClose={() => setDeleteFolderTarget(null)} title="Delete folder" subtitle={deleteFolderTarget.name} icon="ph-trash">
          {({ close }) => {
            const childCount = allFolders.filter((f) => f.parentId === deleteFolderTarget.id).length;
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Delete the folder <b className="text-foreground">{deleteFolderTarget.name}</b>
                  {childCount > 0 && <> and its {childCount} subfolder{childCount > 1 ? 's' : ''}</>}? Projects inside won&apos;t be deleted — they just become uncategorized.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
                  <button type="button" onClick={() => { removeFolder(deleteFolderTarget); close(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-2 text-sm font-bold text-white transition hover:bg-destructive/90"><i className="ph-bold ph-trash" aria-hidden /> Delete folder</button>
                </div>
              </div>
            );
          }}
        </Modal>
      )}
    </>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsInner />
    </Suspense>
  );
}
