'use client';

/**
 * Shown when a note write failed and the optimistic change was rolled back.
 *
 * It exists because the store now reports failures at all. Before, `mutate` fired the writes and
 * discarded their {ok, error} results — a rejected save left the note on screen looking saved, and the
 * user only found out on the next reload, when the writing was gone. Rolling back silently would be no
 * better: the text vanishing under your cursor with no explanation is its own kind of lie.
 */
export function NoteSaveError({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/5 px-3.5 py-2.5">
      <i className="ph-bold ph-warning-circle mt-0.5 shrink-0 text-destructive" aria-hidden />
      <p className="flex-1 text-xs text-destructive">
        <b>Not saved — your change was undone.</b> {error}
      </p>
      <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-destructive/60 hover:text-destructive">
        <i className="ph-bold ph-x" aria-hidden />
      </button>
    </div>
  );
}
