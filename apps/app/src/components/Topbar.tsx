import { ThemeToggle } from './ThemeToggle';
import { NotifTicker } from './NotifTicker';
import { CreditButton } from './CreditButton';
import { BroadcastBell } from './broadcast/BroadcastBell';

export function Topbar({ onMenu, identity }: { onMenu?: () => void; identity?: { company: string; initials: string } }) {
  const initials = identity?.initials ?? 'HV';
  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-7">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="grid h-10 w-10 place-items-center rounded-lg border border-border text-foreground lg:hidden"
      >
        <i className="ph-bold ph-list text-lg" aria-hidden />
      </button>

      <div className="hidden w-1/3 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:flex">
        <i className="ph-bold ph-magnifying-glass" aria-hidden />
        <input
          aria-label="Search"
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Search…"
        />
        <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] font-semibold">⌘K</kbd>
      </div>

      <NotifTicker />
      <div className="flex-1 md:hidden" />

      <CreditButton />
      <ThemeToggle />
      <BroadcastBell />
      <span title={identity ? `Impersonating ${identity.company}` : undefined} className={`grid h-10 w-10 place-items-center rounded-lg text-sm font-bold text-white shadow-md ${identity ? 'bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-amber-400/50' : 'bg-gradient-to-br from-brand-500 to-brand-700'}`}>
        {initials}
      </span>
    </header>
  );
}
