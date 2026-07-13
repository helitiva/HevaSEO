'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SERVICES, type ServiceKey, type Project } from '@/data/mock';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { useProjects, type Folder } from '@/components/ProjectsStore';
import { NewProjectModal, type ProjectInput } from '@/components/NewProjectModal';
import { NewFolderModal, type FolderInput } from '@/components/NewFolderModal';

/** Gear menu on each project card — edit / open / delete. */
function ProjectMenu({ project, onEdit, onDelete, onRestore }: { project: Project; onEdit: () => void; onDelete: () => void; onRestore?: () => void }) {
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
            {onRestore && <button type="button" onClick={(e) => { stop(e); setOpen(false); onRestore(); }} className={item}><i className="ph-bold ph-arrow-counter-clockwise text-muted-foreground" aria-hidden /> Restore</button>}
            <button type="button" onClick={(e) => { stop(e); setOpen(false); onEdit(); }} className={item}><i className="ph-bold ph-pencil-simple text-muted-foreground" aria-hidden /> Edit project</button>
            <button type="button" onClick={(e) => { stop(e); setOpen(false); router.push(`/projects/${project.id}`); }} className={item}><i className="ph-bold ph-arrow-square-out text-muted-foreground" aria-hidden /> Open</button>
            {/* Active project → "Delete" archives it (soft); an already-archived one → permanent delete. */}
            <button type="button" onClick={(e) => { stop(e); setOpen(false); onDelete(); }} className={`${item} ${project.archived ? 'text-destructive hover:bg-destructive/10' : ''}`}>
              <i className={`ph-bold ${project.archived ? 'ph-trash' : 'ph-archive-box'} ${project.archived ? '' : 'text-muted-foreground'}`} aria-hidden /> {project.archived ? 'Delete permanently' : 'Delete (to Archive)'}
            </button>
          </span>
        </>
      )}
    </span>
  );
}

/** Gear menu on each folder row — edit / archive (or delete). */
function FolderMenu({ label, onEdit, onDelete, actionLabel = 'Delete', actionIcon = 'ph-trash', destructive = true }: { label: string; onEdit: () => void; onDelete: () => void; actionLabel?: string; actionIcon?: string; destructive?: boolean }) {
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
          <span className="absolute right-0 z-50 mt-1 block w-44 rounded-xl border border-border bg-card p-1 shadow-xl">
            <button type="button" onClick={(e) => { stop(e); setOpen(false); onEdit(); }} className={item}><i className="ph-bold ph-pencil-simple text-muted-foreground" aria-hidden /> Edit folder</button>
            <button type="button" onClick={(e) => { stop(e); setOpen(false); onDelete(); }} className={destructive ? `${item} text-destructive hover:bg-destructive/10` : item}><i className={`ph-bold ${actionIcon} ${destructive ? '' : 'text-muted-foreground'}`} aria-hidden /> {actionLabel}</button>
          </span>
        </>
      )}
    </span>
  );
}

/** Virtual rail entry id for the archive view (not a real folder). */
const ARCHIVE_ID = '__archive__';

/** One folder row in the rail. Defined at module scope so it keeps a stable identity across renders —
 *  redefining it inside the page component remounted the whole rail on every state change, which made
 *  clicks feel laggy / need a second tap. */
function FolderRow({ id, name, color, depth = 0, icon, active, dragOver, count, onSelect, onDragOverFolder, onDragLeaveFolder, onDropProject, menu }: {
  id: string; name: string; color?: string; depth?: number; icon?: string; active: boolean; dragOver: boolean; count: number;
  onSelect: (id: string) => void;
  onDragOverFolder?: (id: string) => void;
  onDragLeaveFolder?: (id: string) => void;
  onDropProject?: (id: string, projectId: string) => void;
  menu?: ReactNode;
}) {
  const droppable = !!onDropProject;
  // The WHOLE row is the click target (was only the inner icon+name button, leaving the count badge and
  // the gaps as dead zones — taps there did nothing, so folders felt like they needed a second/harder click).
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } }}
      className={`folder-item group w-full select-none${active ? ' active' : ''}${dragOver ? ' drop-hot' : ''}`}
      style={{ paddingLeft: `${0.6 + depth * 0.85}rem` }}
      onDragOver={droppable ? (e) => { e.preventDefault(); onDragOverFolder?.(id); } : undefined}
      onDragLeave={droppable ? () => onDragLeaveFolder?.(id) : undefined}
      onDrop={droppable ? (e) => { e.preventDefault(); const pid = e.dataTransfer.getData('text/plain'); if (pid) onDropProject?.(id, pid); } : undefined}
    >
      <span className="flex min-w-0 flex-1 items-center gap-[.55rem]">
        <i className={`ph-bold ${icon ?? 'ph-folder'} shrink-0`} style={{ color: color ?? 'currentColor' }} aria-hidden />
        <span className="truncate">{name}</span>
      </span>
      {menu}
      <span className="folder-count">{count}</span>
    </div>
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
  const { projects: allProjects, folders: allFolders, addProject, updateProject, removeProject, addFolder, updateFolder, archiveFolder, removeFolder } = useProjects();
  const [modal, setModal] = useState<null | 'project' | 'folder'>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editFolderTarget, setEditFolderTarget] = useState<Folder | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const folderName = (id: string) => allFolders.find((f) => f.id === id)?.name;
  const folderColor = (id: string) => allFolders.find((f) => f.id === id)?.color ?? '#94a3b8';

  // each mutation persists via a server action; surface the real outcome (success or error).
  const createFolder = async (f: FolderInput) => {
    const r = await addFolder(f);
    toast(r.ok ? `Folder “${f.name}” created` : r.error, r.ok ? undefined : 'error');
  };
  const createProject = async (p: ProjectInput) => {
    const proj: Project = {
      id: `p-${Date.now().toString(36)}`,
      name: p.name, domain: p.domain, label: folderName(p.folderId) ?? 'Uncategorized',
      folder: p.folderId, status: p.status, note: p.note, updated: 'Just now', tags: {},
    };
    const r = await addProject(proj);
    if (r.ok) { setFolder('all'); toast(`Project ${proj.domain} created`); } else toast(r.error, 'error');
  };
  const saveEdit = async (p: ProjectInput) => {
    if (!editTarget) return;
    const r = await updateProject(editTarget.id, { name: p.name, domain: p.domain, label: folderName(p.folderId) ?? 'Uncategorized', folder: p.folderId, status: p.status, note: p.note, updated: 'Just now' });
    toast(r.ok ? `Project ${p.domain} updated` : r.error, r.ok ? undefined : 'error');
  };
  // "Delete" an active project = move it to Archive (undoable). Only an already-archived project is deleted
  // permanently (its orders are reassigned to Uncategorized server-side so they aren't orphaned).
  const deleteProject = async (p: Project) => {
    if (!p.archived) { await archiveProject(p); return; }
    const r = await removeProject(p.id);
    toast(r.ok ? `Project ${p.domain || p.name} deleted permanently` : r.error, r.ok ? 'info' : 'error');
  };
  // Delete a folder, keeping its projects active but folder-less ("Uncategorized").
  const deleteFolderKeep = async (f: Folder) => {
    const childIds = allFolders.filter((c) => c.parentId === f.id).map((c) => c.id);
    if (folder === f.id || childIds.includes(folder)) setFolder('all');
    const r = await removeFolder(f.id);
    toast(r.ok ? `Folder “${f.name}” deleted — its projects moved to Uncategorized` : r.error, r.ok ? 'info' : 'error');
  };
  const saveFolderEdit = async (f: FolderInput) => {
    if (!editFolderTarget) return;
    const r = await updateFolder(editFolderTarget.id, { name: f.name, color: f.color, parentId: f.parentId });
    toast(r.ok ? `Folder “${f.name}” updated` : r.error, r.ok ? undefined : 'error');
  };
  // "Move to Archive": the folder's projects are archived (kept, hidden) and the empty folder removed.
  const archiveFolderNow = async (f: Folder) => {
    const childIds = allFolders.filter((c) => c.parentId === f.id).map((c) => c.id);
    if (folder === f.id || childIds.includes(folder)) setFolder('all');
    const r = await archiveFolder(f.id);
    toast(r.ok ? `Folder “${f.name}” moved to Archive` : r.error, r.ok ? 'info' : 'error');
  };
  const restoreProject = async (p: Project) => {
    const r = await updateProject(p.id, { archived: false });
    toast(r.ok ? `Restored ${p.domain}` : r.error, r.ok ? undefined : 'error');
  };
  const archiveProject = async (p: Project) => {
    const r = await updateProject(p.id, { archived: true });
    toast(r.ok ? `Archived ${p.domain}` : r.error, r.ok ? 'info' : 'error');
  };
  const moveProjectToFolder = async (projectId: string, folderId: string) => {
    const p = allProjects.find((x) => x.id === projectId);
    if (!p || (p.folder === folderId && !p.archived)) return;
    const r = await updateProject(projectId, { folder: folderId, label: folderName(folderId) ?? 'Uncategorized', archived: false });
    toast(r.ok ? `Moved ${p.domain} → ${folderName(folderId)}` : r.error, r.ok ? undefined : 'error');
  };
  // Dropping a project onto a rail entry: Archive → archive it; a folder → move (and un-archive) it.
  const onDropProject = (targetId: string, projectId: string) => {
    if (targetId === ARCHIVE_ID) {
      const p = allProjects.find((x) => x.id === projectId);
      if (p && !p.archived) updateProject(projectId, { archived: true }).then((r) => toast(r.ok ? `Archived ${p.domain}` : r.error, r.ok ? 'info' : 'error'));
      return;
    }
    moveProjectToFolder(projectId, targetId);
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

  // active = not archived; archived projects only surface under the Archive rail entry.
  const activeProjects = useMemo(() => allProjects.filter((p) => !p.archived), [allProjects]);
  const archivedProjects = useMemo(() => allProjects.filter((p) => p.archived), [allProjects]);

  const filtered = useMemo(() => {
    const pool = folder === ARCHIVE_ID ? archivedProjects : activeProjects;
    return pool.filter((p) => {
      if (folder !== 'all' && folder !== ARCHIVE_ID && p.folder !== folder) return false;
      if (search && !p.domain.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (svc !== 'all' && !(svc in p.tags)) return false;
      return true;
    });
  }, [activeProjects, archivedProjects, folder, search, status, svc]);

  const countFor = (id: string) => (
    id === 'all' ? activeProjects.length
      : id === ARCHIVE_ID ? archivedProjects.length
      : activeProjects.filter((p) => p.folder === id).length
  );
  const roots = allFolders.filter((f) => !f.parentId);
  const childrenOf = (id: string) => allFolders.filter((f) => f.parentId === id);

  // shared props → the module-level <FolderRow>, so the rail keeps a stable identity (fast clicks).
  const rowProps = (id: string) => ({
    active: folder === id,
    dragOver: dragOverFolder === id,
    count: countFor(id),
    onSelect: setFolder,
    onDragOverFolder: id === 'all' ? undefined : setDragOverFolder,
    onDragLeaveFolder: () => setDragOverFolder((d) => (d === id ? null : d)),
    onDropProject: id === 'all' ? undefined : onDropProject,
  });
  const folderMenu = (id: string, name: string) => (
    <FolderMenu
      label={name}
      actionLabel="Delete folder"
      actionIcon="ph-trash"
      onEdit={() => { const f = allFolders.find((x) => x.id === id); if (f) setEditFolderTarget(f); }}
      onDelete={() => { const f = allFolders.find((x) => x.id === id); if (f) setDeleteFolderTarget(f); }}
    />
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Projects</h1>
            <span className="pill pill-good">{activeProjects.length} projects</span>
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
              <FolderRow id="all" name="All projects" {...rowProps('all')} />
              {roots.map((f) => (
                <div key={f.id} className="space-y-0.5">
                  <FolderRow id={f.id} name={f.name} color={f.color} {...rowProps(f.id)} menu={folderMenu(f.id, f.name)} />
                  {childrenOf(f.id).map((c) => (
                    <FolderRow key={c.id} id={c.id} name={c.name} color={c.color} depth={1} {...rowProps(c.id)} menu={folderMenu(c.id, c.name)} />
                  ))}
                </div>
              ))}
              <FolderRow id={ARCHIVE_ID} name="Archive" icon="ph-archive-box" color="#94a3b8" {...rowProps(ARCHIVE_ID)} />
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
              <span className="truncate font-semibold">{folder === 'all' ? 'All projects' : folder === ARCHIVE_ID ? 'Archive' : folderName(folder)}</span>
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
            folder === ARCHIVE_ID && !search && status === 'all' && svc === 'all' ? (
              <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground text-xl"><i className="ph-bold ph-archive-box" aria-hidden /></span>
                <p className="mt-3 font-semibold">Archive is empty</p>
                <p className="mt-1 text-sm text-muted-foreground">Projects you move to Archive appear here. Drag a project onto Archive, or use “Move to Archive” on a folder.</p>
              </div>
            ) : folder !== 'all' && folder !== ARCHIVE_ID && !search && status === 'all' && svc === 'all' ? (
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
                      <span className="fav" style={{ background: favColor(p.domain || p.name) }}>{initials(p.domain || p.name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-sm font-semibold">{p.domain || p.name}</h3>
                          <ProjectMenu project={p} onEdit={() => setEditTarget(p)} onDelete={() => setDeleteTarget(p)} onRestore={p.archived ? () => restoreProject(p) : undefined} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {p.archived
                            ? <span className="chip" style={{ background: '#94a3b81a', color: '#64748b' }}><i className="ph-bold ph-archive-box" aria-hidden /> Archived</span>
                            : p.label && <span className="chip" style={{ background: `${folderColor(p.folder)}1a`, color: folderColor(p.folder) }}><i className="ph-bold ph-folder" aria-hidden /> {p.label}</span>}
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
        <Modal onClose={() => setDeleteTarget(null)} title={deleteTarget.archived ? 'Delete permanently' : 'Move project to Archive'} subtitle={deleteTarget.domain || deleteTarget.name} icon={deleteTarget.archived ? 'ph-trash' : 'ph-archive-box'}>
          {({ close }) => (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {deleteTarget.archived
                  ? <>Permanently delete <b className="text-foreground">{deleteTarget.domain || deleteTarget.name}</b>? This can&apos;t be undone — its orders move to Uncategorized.</>
                  : <>Move <b className="text-foreground">{deleteTarget.domain || deleteTarget.name}</b> to Archive? Its orders stay linked and you can restore it anytime.</>}
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={close} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
                {deleteTarget.archived
                  ? <button type="button" onClick={() => { deleteProject(deleteTarget); close(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-2 text-sm font-bold text-white transition hover:bg-destructive/90"><i className="ph-bold ph-trash" aria-hidden /> Delete permanently</button>
                  : <button type="button" onClick={() => { deleteProject(deleteTarget); close(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-archive-box" aria-hidden /> Move to Archive</button>}
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
            const projCount = allProjects.filter((p) => p.folder === deleteFolderTarget.id && !p.archived).length;
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Delete <b className="text-foreground">{deleteFolderTarget.name}</b>
                  {childCount > 0 && <> and its {childCount} subfolder{childCount > 1 ? 's' : ''}</>}?
                  {projCount > 0 ? <> Choose what happens to its {projCount} project{projCount === 1 ? '' : 's'}:</> : ' The folder is empty.'}
                </p>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => { deleteFolderKeep(deleteFolderTarget); close(); }} className="flex items-start gap-2.5 rounded-xl border border-border p-3 text-left transition hover:border-primary/50 hover:bg-accent">
                    <i className="ph-bold ph-folder-open mt-0.5 text-primary" aria-hidden />
                    <span><span className="block text-sm font-semibold">Keep projects (Uncategorized)</span><span className="block text-[11px] text-muted-foreground">Projects stay active, just without a folder.</span></span>
                  </button>
                  <button type="button" onClick={() => { archiveFolderNow(deleteFolderTarget); close(); }} className="flex items-start gap-2.5 rounded-xl border border-border p-3 text-left transition hover:border-primary/50 hover:bg-accent">
                    <i className="ph-bold ph-archive-box mt-0.5 text-muted-foreground" aria-hidden />
                    <span><span className="block text-sm font-semibold">Archive projects</span><span className="block text-[11px] text-muted-foreground">Projects are archived — restore anytime from the Archive.</span></span>
                  </button>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={close} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
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
