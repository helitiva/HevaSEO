'use client';

import { useMemo, useState } from 'react';
import { FOLDERS, PROJECTS, SERVICES, type ServiceKey, type Project } from '@/data/mock';

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

const folderName = (id: string) => FOLDERS.find((f) => f.id === id)?.name;
const folderColor = (id: string) => FOLDERS.find((f) => f.id === id)?.color ?? '#94a3b8';

export default function ProjectsPage() {
  const [folder, setFolder] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [svc, setSvc] = useState<string>('all');

  const filtered = useMemo(
    () =>
      PROJECTS.filter((p) => {
        if (folder !== 'all' && p.folder !== folder) return false;
        if (search && !p.domain.toLowerCase().includes(search.toLowerCase())) return false;
        if (status !== 'all' && p.status !== status) return false;
        if (svc !== 'all' && !(svc in p.tags)) return false;
        return true;
      }),
    [folder, search, status, svc]
  );

  const countFor = (id: string) => (id === 'all' ? PROJECTS.length : PROJECTS.filter((p) => p.folder === id).length);
  const roots = FOLDERS.filter((f) => !f.parentId);
  const childrenOf = (id: string) => FOLDERS.filter((f) => f.parentId === id);

  const FolderRow = ({ id, name, color, depth = 0 }: { id: string; name: string; color?: string; depth?: number }) => (
    <button
      onClick={() => setFolder(id)}
      className={`folder-item w-full${folder === id ? ' active' : ''}`}
      style={{ paddingLeft: `${0.6 + depth * 0.85}rem` }}
    >
      <i className="ph-bold ph-folder" style={{ color: color ?? 'currentColor' }} />
      <span className="truncate">{name}</span>
      <span className="folder-count">{countFor(id)}</span>
    </button>
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Projects</h1>
            <span className="pill pill-good">{PROJECTS.length} projects</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Organize websites into folders · track campaigns & overall status</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold transition hover:bg-accent"><i className="ph-bold ph-folder-plus" /> Folder</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-px hover:bg-primary/90 active:scale-[.98]"><i className="ph-bold ph-plus" /> New project</button>
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
              <i className="ph-bold ph-folders" /> Group your websites into folders to track campaigns by client.
            </p>
          </div>
        </aside>

        {/* content */}
        <section className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/70 p-3 backdrop-blur md:flex-row md:items-center">
            <div className="flex min-w-0 shrink items-center gap-2 text-sm">
              <i className="ph-bold ph-folder-open text-primary" />
              <span className="truncate font-semibold">{folder === 'all' ? 'All projects' : folderName(folder)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:ml-auto md:flex-nowrap md:shrink-0">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
                <i className="ph-bold ph-magnifying-glass text-muted-foreground" />
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
            <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground"><i className="ph-bold ph-folder-dashed text-xl" /></span>
              <p className="mt-3 font-semibold">No matching projects</p>
              <p className="mt-1 text-sm text-muted-foreground">Try adjusting the filters, or create a new project.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => {
                const sp = STATUS_PILL[p.status];
                const tags = Object.keys(p.tags) as ServiceKey[];
                return (
                  <article key={p.id} className="pcard">
                    <div className="flex items-start gap-2.5">
                      <span className="fav" style={{ background: favColor(p.domain) }}>{initials(p.domain)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-sm font-semibold">{p.domain}</h3>
                          <button className="card-gear ml-auto" title="Project settings"><i className="ph-bold ph-gear-six" /></button>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="chip" style={{ background: `${folderColor(p.folder)}1a`, color: folderColor(p.folder) }}>
                            <i className="ph-bold ph-folder" /> {p.label}
                          </span>
                          <span className="pill" style={{ background: `${sp.color}1f`, color: sp.color }}>● {sp.label}</span>
                        </div>
                      </div>
                    </div>

                    <p className="note mt-3 flex gap-1.5 text-[12px] leading-snug text-muted-foreground">
                      <i className="ph-bold ph-note-pencil mt-px shrink-0" />
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
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
