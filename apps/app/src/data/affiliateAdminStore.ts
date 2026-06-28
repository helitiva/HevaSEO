'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminAffiliates, partnerTier, type AdminAffiliate } from '@/data/adminAffiliate';
import { genCode, type TierId } from '@/lib/affiliate';
import { createAccount, type Account } from '@/lib/auth';

// Admin-side overlay over the affiliate seeds (Phase-0 mock, localStorage only).
// Two overlays, same window-event pattern as broadcastStore:
//   - created partners (full AdminAffiliate rows the admin provisioned)
//   - a tier-override map (partner id → TierId) so the admin can pin a tier above
//     or below the volume-derived default without touching seed data.
// effectiveTier = tierOverride[id] ?? partnerTier(a). Created partners and the
// override map merge with adminAffiliates() seeds; nothing here mutates the seeds.

const CREATED_KEY = 'heva:affiliates:created:v1';
const TIER_KEY = 'heva:affiliates:tier:v1';
const EVT = 'heva:affiliates-changed';

type TierOverrides = Record<string, TierId>;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

function newPartnerId(): string { return `af-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`; }
function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '??';
}

// The merged list every consumer reads: seeds + created, each with effectiveTier.
export type AdminAffiliateWithTier = AdminAffiliate & { effectiveTier: TierId };

function mergeAll(created: AdminAffiliate[], overrides: TierOverrides): AdminAffiliateWithTier[] {
  const createdIds = new Set(created.map((p) => p.id));
  const seeds = adminAffiliates().filter((s) => !createdIds.has(s.id));
  const all = [...created, ...seeds];
  return all.map((a) => ({ ...a, effectiveTier: overrides[a.id] ?? partnerTier(a) }));
}

// Volume-derived default unless the admin pinned an override.
export function effectiveTier(a: AdminAffiliate, overrides: TierOverrides): TierId {
  return overrides[a.id] ?? partnerTier(a);
}

// ── create a partner + its login account in one shot ────────────────────────────
export interface CreatePartnerInput {
  name: string; handle: string; platform: string; niche: string; email: string; code: string; tier: TierId;
}
export function createPartner(input: CreatePartnerInput): { account: Account; tempPassword: string; partner: AdminAffiliate } {
  const id = newPartnerId();
  const partner: AdminAffiliate = {
    id,
    name: input.name.trim(),
    handle: input.handle.trim(),
    avatarInitials: initialsOf(input.name),
    platform: input.platform.trim() || 'Other',
    niche: input.niche.trim() || 'General',
    email: input.email.trim(),
    code: (input.code.trim() || genCode(input.name)).toUpperCase(),
    status: 'active',
    joinedAt: todayIso(),
    lastActiveAt: todayIso(),
    refs: 0, volume: 0, commission: 0, claimed: 0,
  };
  const created = readJson<AdminAffiliate[]>(CREATED_KEY, []);
  writeJson(CREATED_KEY, [partner, ...created]);

  // Pin the chosen tier as an override (the new partner has 0 volume → would be Bronze).
  const overrides = readJson<TierOverrides>(TIER_KEY, {});
  writeJson(TIER_KEY, { ...overrides, [id]: input.tier });

  const { account, tempPassword } = createAccount({ role: 'affiliate', name: partner.name, email: partner.email, entityId: id });
  return { account, tempPassword, partner };
}

// Set (or clear with null = revert to volume-derived) a partner's tier override.
export function setPartnerTier(id: string, tier: TierId | null): void {
  const overrides = readJson<TierOverrides>(TIER_KEY, {});
  if (tier === null) {
    const { [id]: _drop, ...rest } = overrides;
    writeJson(TIER_KEY, rest);
  } else {
    writeJson(TIER_KEY, { ...overrides, [id]: tier });
  }
}

// Whether a partner's tier is currently pinned (vs volume-derived).
export function isTierOverridden(id: string, overrides: TierOverrides): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, id);
}

// ── hooks ───────────────────────────────────────────────────────────────────────
function useOverlay() {
  const [created, setCreated] = useState<AdminAffiliate[]>([]);
  const [overrides, setOverrides] = useState<TierOverrides>({});
  useEffect(() => {
    const load = () => {
      setCreated(readJson<AdminAffiliate[]>(CREATED_KEY, []));
      setOverrides(readJson<TierOverrides>(TIER_KEY, {}));
    };
    load();
    window.addEventListener(EVT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, []);
  return { created, overrides };
}

// Merged partner list, each with effectiveTier + the live override map.
export function useAdminAffiliates(): { partners: AdminAffiliateWithTier[]; overrides: TierOverrides } {
  const { created, overrides } = useOverlay();
  return { partners: mergeAll(created, overrides), overrides };
}

// Imperative helpers bound to the window-event store (no re-render needed by caller).
export function useAffiliateActions() {
  return {
    createPartner: useCallback((input: CreatePartnerInput) => createPartner(input), []),
    setPartnerTier: useCallback((id: string, tier: TierId | null) => setPartnerTier(id, tier), []),
  };
}
