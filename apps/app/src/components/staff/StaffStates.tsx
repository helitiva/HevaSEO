'use client';

// Warm, reusable loading + error states for staff screens (spec §4).
// EmptyState lives in EmptyState.tsx; these cover the other two states.

export function LoadingRows({ rows = 3, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <div className="kcard" role="status" aria-live="polite" aria-label={label}>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="h-5 w-20 shrink-0 animate-pulse rounded-md bg-muted" />
            <span className="h-5 flex-1 animate-pulse rounded-md bg-muted" />
            <span className="h-5 w-12 shrink-0 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

// A real error state: names the thing that failed and offers the next action (Retry).
export function ErrorState({
  message = 'Something interrupted the load.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="kcard flex flex-col items-center gap-3 py-10 text-center" role="alert">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <i className="ph-bold ph-warning-octagon text-2xl" aria-hidden />
      </span>
      <div>
        <p className="display text-base font-bold">We couldn’t load that</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent"
        >
          <i className="ph-bold ph-arrow-clockwise" aria-hidden /> Retry
        </button>
      )}
    </div>
  );
}
