// Tiny bar trend (reuses the `.mini-bars` class; last bar highlighted).
export function MiniBars({ data }: { data: number[] }) {
  const max = Math.max(...data) || 1;
  return (
    <div className="mini-bars" aria-hidden>
      {data.map((v, i) => (
        <i key={i} className={i === data.length - 1 ? 'on' : ''} style={{ height: `${Math.max(12, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}
