import { ThemeToggle } from '../ThemeToggle';

export function AdminTopbar({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-[68px] shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-xl lg:px-7">
      <button onClick={onMenu} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-lg border border-border lg:hidden">
        <i className="ph-bold ph-list text-lg" />
      </button>
      <div className="hidden w-1/3 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:flex">
        <i className="ph-bold ph-magnifying-glass" />
        <input aria-label="Search" className="w-full bg-transparent outline-none" placeholder="Search orders, customers…" />
        <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] font-semibold">⌘K</kbd>
      </div>
      <div className="flex-1" />
      <ThemeToggle />
      <button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent">
        <i className="ph-bold ph-bell text-lg" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
      </button>
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md">AD</span>
    </header>
  );
}
