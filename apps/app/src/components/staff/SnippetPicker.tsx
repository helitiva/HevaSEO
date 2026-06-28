'use client';
import { useState } from 'react';

// A tap-to-insert list of saved replies for a textarea. Staff pick a phrase to fill the field, or
// save what they've typed as a new reply (session-only in the mock).
export function SnippetPicker({ snippets, current, onPick, onAdd, onRemove }: {
  snippets: string[];
  current: string;
  onPick: (s: string) => void;
  onAdd: (s: string) => void;
  onRemove: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const canSave = current.trim().length > 0 && !snippets.includes(current.trim());

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
        <i className="ph-bold ph-lightning" aria-hidden /> Saved replies <i className={`ph-bold ph-caret-down transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-72 rounded-xl border border-border bg-card p-1.5 shadow-xl">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tap to insert</p>
            <ul className="scrollbar-thin max-h-56 space-y-0.5 overflow-y-auto">
              {snippets.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">No saved replies yet.</li>}
              {snippets.map((s) => (
                <li key={s} className="group flex items-start gap-1 rounded-lg px-1 hover:bg-muted">
                  <button type="button" onClick={() => { onPick(s); setOpen(false); }} className="min-w-0 flex-1 px-1 py-1.5 text-left text-xs">{s}</button>
                  <button type="button" onClick={() => onRemove(s)} aria-label="Remove reply" className="mt-1 shrink-0 px-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"><i className="ph-bold ph-x" aria-hidden /></button>
                </li>
              ))}
            </ul>
            <button type="button" disabled={!canSave} onClick={() => onAdd(current.trim())}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border px-2 py-1.5 text-xs font-semibold text-primary transition enabled:hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
              title={canSave ? 'Save the current text as a reusable reply' : 'Type something first'}>
              <i className="ph-bold ph-plus" aria-hidden /> Save current text as a reply
            </button>
          </div>
        </>
      )}
    </div>
  );
}
