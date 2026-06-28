// Broadcast messaging — admin sends a message to one or more audiences (customer / staff /
// manager / affiliate). Each recipient surface shows it three ways: a notification bell, an
// overview banner (when `banner` is on), and a shared Inbox page. Phase-0 mock.

export type BroadcastAudience = 'customer' | 'staff' | 'manager' | 'affiliate';
export const BROADCAST_AUDIENCES: BroadcastAudience[] = ['customer', 'staff', 'manager', 'affiliate'];

export type BroadcastKind = 'congrats' | 'notice' | 'info' | 'warning' | 'maintenance' | 'outage';

export interface BroadcastCta { label: string; href: string }

export interface Broadcast {
  id: string;
  title: string;
  body: string;                 // plain text (rendered with line breaks)
  kind: BroadcastKind;
  audiences: BroadcastAudience[];
  banner: boolean;              // also surface as an overview banner popup
  pinned?: boolean;
  cta?: BroadcastCta | null;
  createdAt: string;            // ISO datetime
  expiresAt?: string | null;    // ISO date; past = no longer delivered
  active: boolean;              // recalled → false
  system?: boolean;             // built-in seed (read-only)
}

export const AUDIENCE_META: Record<BroadcastAudience, { label: string; icon: string; color: string }> = {
  customer: { label: 'Customers', icon: 'ph-user', color: '#22c55e' },
  staff: { label: 'Staff', icon: 'ph-user-gear', color: '#6366f1' },
  manager: { label: 'Managers', icon: 'ph-user-circle-gear', color: '#0ea5e9' },
  affiliate: { label: 'Affiliates', icon: 'ph-megaphone', color: '#f59e0b' },
};

export const KIND_META: Record<BroadcastKind, {
  label: string; icon: string; color: string;
  // banner palette (works in both themes via /15 tints + the accent colour)
  bannerClass: string; celebratory?: boolean;
}> = {
  congrats: { label: 'Congrats', icon: 'ph-confetti', color: '#10b981', bannerClass: 'from-emerald-500/15 to-teal-500/10 border-emerald-500/40', celebratory: true },
  notice: { label: 'Notice', icon: 'ph-megaphone', color: '#6366f1', bannerClass: 'from-indigo-500/15 to-violet-500/10 border-indigo-500/40' },
  info: { label: 'Update', icon: 'ph-info', color: '#0ea5e9', bannerClass: 'from-sky-500/15 to-cyan-500/10 border-sky-500/40' },
  warning: { label: 'Warning', icon: 'ph-warning', color: '#f59e0b', bannerClass: 'from-amber-500/15 to-orange-500/10 border-amber-500/40' },
  maintenance: { label: 'Maintenance', icon: 'ph-wrench', color: '#8b5cf6', bannerClass: 'from-violet-500/15 to-fuchsia-500/10 border-violet-500/40' },
  outage: { label: 'Disruption', icon: 'ph-warning-octagon', color: '#ef4444', bannerClass: 'from-rose-500/15 to-red-500/10 border-rose-500/50' },
};
export const KINDS = Object.keys(KIND_META) as BroadcastKind[];

export function isLive(b: Broadcast, now = new Date()): boolean {
  if (!b.active) return false;
  if (b.expiresAt && new Date(b.expiresAt).getTime() < now.getTime()) return false;
  return true;
}

// ── Seed messages (examples across kinds/audiences) ──────────────────────────
export const BROADCAST_SEEDS: Broadcast[] = [
  {
    id: 'bc-launch', title: 'New: AI visibility reports are live 🎉', kind: 'congrats',
    body: 'Every audit now includes an AI-visibility score — see how your brand shows up in AI answers. Open any completed audit to view it.',
    audiences: ['customer', 'affiliate'], banner: true, pinned: true,
    cta: { label: 'See what’s new', href: '/docs' },
    createdAt: '2026-06-27T09:00:00', active: true, system: true,
  },
  {
    id: 'bc-maint', title: 'Scheduled maintenance · Sun 02:00–03:00 UTC', kind: 'maintenance',
    body: 'We’ll be upgrading our delivery pipeline this Sunday. The dashboard may be briefly unavailable during the window. No action needed.',
    audiences: ['customer', 'staff', 'manager', 'affiliate'], banner: true,
    createdAt: '2026-06-26T15:00:00', expiresAt: '2026-06-30', active: true, system: true,
  },
  {
    id: 'bc-staff-q', title: 'Q2 quality streak — nice work, team', kind: 'congrats',
    body: 'First-pass approval hit 88% this quarter, an all-time high. Thank you for the care you put into every deliverable.',
    audiences: ['staff', 'manager'], banner: false,
    createdAt: '2026-06-25T10:00:00', active: true, system: true,
  },
  {
    id: 'bc-policy', title: 'Updated anchor-text policy', kind: 'notice',
    body: 'The link-building anchor policy has been refreshed — exact-match anchors are now capped at 10% of a profile. Read the updated doc before your next outreach batch.',
    audiences: ['staff'], banner: false, cta: { label: 'Read the policy', href: '/staff/docs' },
    createdAt: '2026-06-24T08:30:00', active: true, system: true,
  },
];
