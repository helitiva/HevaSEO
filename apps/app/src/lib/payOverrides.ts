'use client';
import { useCallback, useEffect, useState } from 'react';
import { gigRateFor } from '@/data/adminMock';

// Per-staff pay overrides — the SINGLE source shared by the Finance > Payouts tab and the
// admin staff profile. Same localStorage key the Finance page already persists to, so setting
// a staffer's salary/rate/bonus/gig-rates in either place is reflected in the other. A real app
// would put this on the server; this is the Phase-0 mock equivalent.
//
// rate is a whole-number PERCENT (e.g. 30); base/bonus are USD; gigRates maps a service →
// the $ a delivered gig of that service pays for THIS staffer (overriding the global GIG_RATE).
const KEY = 'heva.finance.payoutOverrides';
const PRESET_KEY = 'heva.finance.payPresets';
const EVT = 'heva:pay-overrides-changed';

// gigRates: service → $ per gig. gigPkgRates: `${service}::${pkg}` → $ per gig (advanced, wins
// over the service rate). Resolution order per gig: package rate → service rate → global GIG_RATE.
export interface PayOverride { base: number; rate: number; bonus: number; gigRates?: Record<string, number>; gigPkgRates?: Record<string, number> }

type OverrideMap = Record<string, PayOverride>;

function readMap(): OverrideMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OverrideMap) : {};
  } catch {
    return {};
  }
}
function writeMap(map: OverrideMap): void {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* quota / unavailable — ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function usePayOverride(staffId: string) {
  const [override, setOverride] = useState<PayOverride | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => setOverride(readMap()[staffId]);
    load();
    setReady(true);
    window.addEventListener(EVT, load);          // same-tab updates
    window.addEventListener('storage', load);    // other-tab updates
    return () => {
      window.removeEventListener(EVT, load);
      window.removeEventListener('storage', load);
    };
  }, [staffId]);

  const save = useCallback((next: PayOverride) => {
    const m = readMap(); m[staffId] = next; writeMap(m); setOverride(next);
  }, [staffId]);
  const clear = useCallback(() => {
    const m = readMap(); delete m[staffId]; writeMap(m); setOverride(undefined);
  }, [staffId]);

  return { override, ready, save, clear };
}

// The override map key for a (service, package) pair.
export function gigKey(service: string, pkg: string): string { return `${service}::${pkg}`; }

// The effective $ rate for a gig: package rate → service rate → global GIG_RATE.
export function gigRateOf(service: string, pkg?: string, gigRates?: Record<string, number>, gigPkgRates?: Record<string, number>): number {
  if (pkg !== undefined && gigPkgRates?.[gigKey(service, pkg)] !== undefined) return gigPkgRates[gigKey(service, pkg)];
  return gigRates?.[service] ?? gigRateFor(service);
}

// Gig pay for a staffer = Σ over their delivered gigs of the effective per-gig rate.
export type GigCount = { service: string; pkg: string; count: number };
export function gigPay(gigCounts: GigCount[], gigRates?: Record<string, number>, gigPkgRates?: Record<string, number>): number {
  return gigCounts.reduce((sum, g) => sum + g.count * gigRateOf(g.service, g.pkg, gigRates, gigPkgRates), 0);
}

// The cycle comp from a payroll seed + optional override. Mirrors Finance's effComp:
// commission = basis × rate%, gig = Σ gigCounts × effective per-gig rate, total = base + gig + commission + bonus.
export interface PaySeed { base: number; rate: number; basis: number; gigCounts: GigCount[]; bonus: number }
export function effectivePay(seed: PaySeed, ov?: PayOverride) {
  const base = ov ? ov.base : seed.base;
  const ratePct = ov ? ov.rate : Math.round(seed.rate * 1000) / 10; // keep 1 decimal (rates can be e.g. 3.4%)
  const bonus = ov ? ov.bonus : seed.bonus;
  const commission = Math.round(seed.basis * (ratePct / 100) * 100) / 100; // cents (decimal rates → cent-accurate)
  const gig = gigPay(seed.gigCounts, ov?.gigRates, ov?.gigPkgRates);
  return { base, ratePct, bonus, commission, gig, total: base + gig + commission + bonus };
}

// ── Saved pay presets ─────────────────────────────────────────────────────────
// A reusable pay template the admin can apply to any staffer to fill the form quickly.
export interface PayPreset { id: string; name: string; base: number; rate: number; bonus: number; gigRates: Record<string, number>; gigPkgRates?: Record<string, number> }

function readPresets(): PayPreset[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem(PRESET_KEY); return raw ? (JSON.parse(raw) as PayPreset[]) : []; } catch { return []; }
}
function writePresets(list: PayPreset[]): void {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function usePayPresets() {
  const [presets, setPresets] = useState<PayPreset[]>([]);
  useEffect(() => {
    const load = () => setPresets(readPresets());
    load();
    window.addEventListener(EVT, load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, []);
  const addPreset = useCallback((p: Omit<PayPreset, 'id'>) => {
    const list = readPresets();
    const next = [{ ...p, id: `pp-${Date.now().toString(36)}` }, ...list];
    writePresets(next); setPresets(next);
  }, []);
  const removePreset = useCallback((id: string) => {
    const next = readPresets().filter((x) => x.id !== id);
    writePresets(next); setPresets(next);
  }, []);
  return { presets, addPreset, removePreset };
}
