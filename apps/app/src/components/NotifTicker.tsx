import { ACTIVITY } from '@/data/mock';

/** Scrolling notification ticker in the topbar (CSS-animated; items duplicated for a seamless loop). */
export function NotifTicker() {
  const items = [...ACTIVITY, ...ACTIVITY];
  return (
    <div className="ticker relative hidden min-w-0 flex-1 overflow-hidden md:block">
      <div className="ticker-track flex items-center gap-10 whitespace-nowrap">
        {items.map((a, i) => (
          <span key={i} className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <i className={`ph-fill ${a.icon} ${a.cls}`} />
            <span dangerouslySetInnerHTML={{ __html: a.html }} />
          </span>
        ))}
      </div>
    </div>
  );
}
