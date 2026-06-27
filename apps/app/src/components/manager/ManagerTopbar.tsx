import { ThemeToggle } from '../ThemeToggle';
import { MANAGERS } from '@/data/adminMock';
import { MANAGER_PERSONA } from '@/lib/managerScope';

const me = MANAGERS.find((m) => m.id === MANAGER_PERSONA) ?? null;
const initials = me ? me.name.split(' ').map((p) => p[0]).slice(0, 2).join('') : 'MG';

export function ManagerTopbar({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-[68px] shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-xl lg:px-7">
      <button onClick={onMenu} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-lg border border-border lg:hidden">
        <i className="ph-bold ph-list text-lg" />
      </button>
      <div className="hidden w-1/3 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:flex">
        <i className="ph-bold ph-magnifying-glass" />
        <input aria-label="Search" className="w-full bg-transparent outline-none" placeholder="Search my pod…" />
        <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] font-semibold">⌘K</kbd>
      </div>
      <div className="flex-1" />
      {me && (
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 sm:flex">
          <i className="ph-bold ph-users-three" /> {me.name}’s pod
        </span>
      )}
      <ThemeToggle />
      <button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent">
        <i className="ph-bold ph-bell text-lg" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
      </button>
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-md">{initials}</span>
    </header>
  );
}
