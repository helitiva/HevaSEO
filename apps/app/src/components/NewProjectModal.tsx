'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import type { Project } from '@/data/mock';

export interface ProjectInput {
  name: string;
  domain: string;
  folderId: string;
  status: Project['status'];
  note: string;
}
type FolderOpt = { id: string; name: string; parentId: string | null };

const fieldCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

/** Strip protocol/path so "https://site.com/x" → "site.com". */
const cleanDomain = (raw: string) => raw.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();

export function NewProjectModal({
  onClose, folders, onCreate, initial,
  title = 'New project', subtitle = 'Add a website and track its campaigns', submitLabel = 'Create project', icon = 'ph-plus',
}: {
  onClose: () => void;
  folders: FolderOpt[];
  onCreate: (p: ProjectInput) => void;
  initial?: ProjectInput;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  icon?: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [domain, setDomain] = useState(initial?.domain ?? '');
  const [folderId, setFolderId] = useState(initial?.folderId ?? folders[0]?.id ?? '');
  const [status, setStatus] = useState<Project['status']>(initial?.status ?? 'planned');
  const [note, setNote] = useState(initial?.note ?? '');

  const depthOf = (f: FolderOpt) => (f.parentId ? 1 : 0);

  return (
    <Modal onClose={onClose} title={title} subtitle={subtitle} icon={icon}>
      {({ close }) => {
        const submit = (e: FormEvent) => {
          e.preventDefault();
          const d = cleanDomain(domain);
          if (!d) return;
          onCreate({ name: name.trim() || d, domain: d, folderId, status, note: note.trim() });
          close();
        };
        return (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Website domain<span className="text-primary"> *</span></label>
              <input autoFocus value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className={fieldCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Project name<span className="ml-1 font-normal text-muted-foreground">(optional)</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Defaults to the domain" className={fieldCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Folder</label>
                <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className={`${fieldCls} appearance-none`}>
                  {folders.map((f) => <option key={f.id} value={f.id}>{depthOf(f) ? '— ' : ''}{f.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as Project['status'])} className={`${fieldCls} appearance-none`}>
                  <option value="planned">Planning</option>
                  <option value="progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Note<span className="ml-1 font-normal text-muted-foreground">(optional)</span></label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Goals, priorities, reporting cadence…" className={`${fieldCls} resize-y leading-relaxed`} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
              <button type="submit" disabled={!cleanDomain(domain)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"><i className="ph-bold ph-check" aria-hidden /> {submitLabel}</button>
            </div>
          </form>
        );
      }}
    </Modal>
  );
}
