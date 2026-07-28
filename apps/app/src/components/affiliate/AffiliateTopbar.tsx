'use client';
import { ThemeToggle } from '../ThemeToggle';
import { BroadcastBell } from '../broadcast/BroadcastBell';
import { AccountMenu } from '../auth/AccountMenu';
import { tierFor } from '@/lib/affiliate';

export interface AffiliateIdentity {
  name: string;
  handle: string;
  platform: string;
  avatarInitials: string;
  volume: number;
  impersonated: boolean;
}

export function AffiliateTopbar({ onMenu, identity }: { onMenu?: () => void; identity: AffiliateIdentity }) {
  const tier = tierFor(identity.volume);

  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-7">
      <button onClick={onMenu} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-lg border border-border lg:hidden">
        <i className="ph-bold ph-list text-lg" aria-hidden />
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">{identity.name}</p>
        <p className="truncate text-xs text-muted-foreground">{identity.handle} · {identity.platform}</p>
      </div>
      <div className="flex-1" />
      <span className="hidden items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 sm:inline-flex">
        <i className="ph-fill ph-crown-simple" aria-hidden /> {tier.label} · {Math.round(tier.rate * 100)}%
      </span>
      <ThemeToggle />
      <BroadcastBell />
      <AccountMenu initials={identity.avatarInitials} accentClass={identity.impersonated ? 'bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-amber-400/50' : undefined} />
    </header>
  );
}
