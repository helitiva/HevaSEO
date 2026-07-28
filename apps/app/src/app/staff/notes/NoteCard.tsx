'use client';
import { useState } from 'react';
import { Attachment } from './NoteAttachment';
import { NOTE_COLORS, fmtNoteDate, type StaffNote } from '@/data/staffNotes';

interface Props {
  note: StaffNote;
  onOpen: () => void;
  onEdit?: () => void;
  onTogglePin?: () => void;
  onDelete?: () => void;
}

export function NoteCard({ note, onOpen, onEdit, onTogglePin, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const c = NOTE_COLORS[note.color];

  return (
    <div
      className="kcard group relative flex flex-col gap-2"
      style={{ backgroundColor: c.tint === 'transparent' ? undefined : c.tint, borderColor: note.color === 'default' ? undefined : c.ring }}
    >
      {/* Hover actions — only shown when mutation callbacks are provided (hidden in view mode) */}
      {(onTogglePin || onEdit || onDelete) && (
        <div className="absolute right-2 top-2 z-[1] flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          {onTogglePin && <IconBtn icon={note.pinned ? 'ph-push-pin-slash' : 'ph-push-pin'} label={note.pinned ? 'Unpin' : 'Pin'} onClick={onTogglePin} active={note.pinned} />}
          {onEdit && <IconBtn icon="ph-pencil-simple" label="Edit" onClick={onEdit} />}
          {onDelete && <IconBtn icon="ph-trash" label="Delete" onClick={() => setConfirmDelete(true)} danger />}
        </div>
      )}

      {note.pinned && (
        <i className="ph-fill ph-push-pin absolute left-2 top-2 text-xs text-amber-500 group-hover:opacity-0" aria-label="Pinned" />
      )}

      {/* Clickable read area (title + body) — opens the full reader */}
      <button onClick={onOpen} className="block w-full cursor-pointer text-left">
        {note.title && <h3 className="display pr-16 font-bold leading-snug transition group-hover:text-primary">{note.title}</h3>}
        {note.body && (
          <div
            className="note-html note-html-clamp mt-1 text-sm leading-relaxed text-foreground/85"
            // Stored note HTML is sanitized at save time (lib/sanitizeHtml); seeds are author-trusted.
            dangerouslySetInnerHTML={{ __html: note.body }}
          />
        )}
      </button>

      {note.attachments.length > 0 && (
        <div className="space-y-2">
          {note.attachments.map((a) => <Attachment key={a.id} att={a} />)}
        </div>
      )}

      {note.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.labels.map((l) => (
            <span key={l} className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">#{l}</span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.dot }} aria-hidden />
          {note.category}
        </span>
        <span className="ml-auto">{fmtNoteDate(note.updatedAt)}</span>
      </div>

      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[.8rem] bg-card/95 p-4 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold">Delete this note?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-accent">Cancel</button>
            <button onClick={() => onDelete?.()} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90">Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon, label, onClick, danger, active }: { icon: string; label: string; onClick: () => void; danger?: boolean; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 place-items-center rounded-md border border-border bg-card/80 backdrop-blur transition hover:bg-accent ${danger ? 'hover:text-rose-500' : ''} ${active ? 'text-amber-500' : 'text-muted-foreground'}`}
    >
      <i className={`ph-bold ${icon} text-sm`} aria-hidden />
    </button>
  );
}
