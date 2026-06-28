'use client';
import { useRouter } from 'next/navigation';
import { usePortalBase } from '@/lib/portalBase';
import { NoteModal } from './NoteModal';
import { Attachment } from './NoteAttachment';
import { NOTE_COLORS, type StaffNote } from '@/data/staffNotes';

const fmtFull = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

interface Props {
  note: StaffNote | null;
  onClose: () => void;
  onEdit?: () => void;
  onTogglePin?: () => void;
  onDelete?: () => void;
}

export function NoteReader({ note, onClose, onEdit, onTogglePin, onDelete }: Props) {
  const router = useRouter();
  const base = usePortalBase();
  if (!note) return null;
  const c = NOTE_COLORS[note.color];
  const openFullPage = () => { onClose(); router.push(`${base}/notes/${note.id}`); };

  return (
    <NoteModal open={!!note} onClose={onClose} ariaLabel={note.title || 'Note'} widthClass="max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border p-5" style={{ borderTopColor: c.dot, borderTopWidth: 3 }}>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.dot }} aria-hidden /> {note.category}
            </span>
            {note.pinned && <span className="inline-flex items-center gap-1 text-amber-500"><i className="ph-fill ph-push-pin" aria-hidden /> Pinned</span>}
            <span>Updated {fmtFull(note.updatedAt)}</span>
          </div>
          <h2 className="display text-xl font-bold leading-snug">{note.title || 'Untitled note'}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <HeaderBtn icon="ph-arrows-out-simple" label="Open full page" onClick={openFullPage} />
          {onTogglePin && <HeaderBtn icon={note.pinned ? 'ph-push-pin-slash' : 'ph-push-pin'} label={note.pinned ? 'Unpin' : 'Pin'} onClick={onTogglePin} active={note.pinned} />}
          {onEdit && <HeaderBtn icon="ph-pencil-simple" label="Edit" onClick={onEdit} />}
          <HeaderBtn icon="ph-x" label="Close" onClick={onClose} />
        </div>
      </div>

      {/* Body */}
      <div className="scrollbar-thin max-h-[72vh] overflow-y-auto p-5">
        {note.body ? (
          <div className="note-html text-[15px] leading-relaxed text-foreground/90" dangerouslySetInnerHTML={{ __html: note.body }} />
        ) : (
          <p className="text-sm italic text-muted-foreground">No content.</p>
        )}

        {note.attachments.length > 0 && (
          <div className="mt-4 space-y-2">
            {note.attachments.map((a) => <Attachment key={a.id} att={a} />)}
          </div>
        )}

        {note.labels.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {note.labels.map((l) => (
              <span key={l} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">#{l}</span>
            ))}
          </div>
        )}
      </div>

      {/* Footer — mutation buttons only shown when not in view-only mode */}
      {(onDelete || onEdit) && (
        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          {onDelete ? (
            <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:border-rose-300 hover:text-rose-500">
              <i className="ph-bold ph-trash" aria-hidden /> Delete
            </button>
          ) : <span />}
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              <i className="ph-bold ph-pencil-simple" aria-hidden /> Edit note
            </button>
          )}
        </div>
      )}
    </NoteModal>
  );
}

function HeaderBtn({ icon, label, onClick, active }: { icon: string; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-lg border border-border transition hover:bg-accent ${active ? 'text-amber-500' : 'text-muted-foreground'}`}
    >
      <i className={`ph-bold ${icon}`} aria-hidden />
    </button>
  );
}
