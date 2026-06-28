'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';

export interface FolderInput { id: string; name: string; color: string; parentId: string | null; }
type FolderOpt = { id: string; name: string };

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#14b8a6'];
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const fieldCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

export function NewFolderModal({
  onClose, rootFolders, onCreate, initial,
  title = 'New folder', subtitle = 'Group websites by client or campaign', submitLabel = 'Create folder', icon = 'ph-folder-plus',
}: {
  onClose: () => void;
  rootFolders: FolderOpt[];
  onCreate: (f: FolderInput) => void;
  initial?: { name: string; color: string; parentId: string | null };
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  icon?: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [parentId, setParentId] = useState(initial?.parentId ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);

  return (
    <Modal onClose={onClose} title={title} subtitle={subtitle} icon={icon}>
      {({ close }) => {
        const submit = (e: FormEvent) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          onCreate({ id: `${slugify(n) || 'folder'}-${Date.now().toString(36)}`, name: n, color, parentId: parentId || null });
          close();
        };
        return (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Folder name<span className="text-primary"> *</span></label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Retail clients" className={fieldCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Parent folder<span className="ml-1 font-normal text-muted-foreground">(optional)</span></label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={`${fieldCls} appearance-none`}>
                <option value="">None — top level</option>
                {rootFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Pick color ${c}`}
                    aria-pressed={color === c}
                    className={`h-7 w-7 rounded-full transition ${color === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
              <button type="submit" disabled={!name.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"><i className="ph-bold ph-check" aria-hidden /> {submitLabel}</button>
            </div>
          </form>
        );
      }}
    </Modal>
  );
}
