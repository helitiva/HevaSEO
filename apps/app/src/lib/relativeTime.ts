// Short relative time label ("just now", "5m", "3h", "2d", else a date). Deterministic-friendly:
// pass a `now` for SSR if needed; defaults to the call time.
export function ago(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 0) return 'soon';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
