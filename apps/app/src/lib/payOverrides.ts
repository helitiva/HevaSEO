'use client';
import { useCallback, useEffect, useState } from 'react';

// Per-staff pay overrides — the SINGLE source shared by the Finance > Payouts tab and the
// admin staff profile. Same localStorage key the Finance page already persists to, so setting
// a staffer's salary/rate/bonus in either place is reflected in the other. A real app would put
// this on the server; this is the Phase-0 mock equivalent.
//
// Shape mirrors the Finance PayoutOverride: rate is a whole-number PERCENT (e.g. 30), base and
// bonus are USD. The cycle math (base + gig + commission + bonus) lives in effectivePay below
// and matches the Finance effComp exactly.
const KEY = 'heva.finance.payoutOverrides';
const EVT = 'heva:pay-overrides-changed';

export interface PayOverride { base: number; rate: number; bonus: number }

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

// The cycle comp from a payroll seed + optional override. Mirrors Finance's effComp:
// commission = basis × rate%, gig is a fixed piece-rate total, total = base + gig + commission + bonus.
export interface PaySeed { base: number; rate: number; basis: number; gig: number; bonus: number }
export function effectivePay(seed: PaySeed, ov?: PayOverride) {
  const base = ov ? ov.base : seed.base;
  const ratePct = ov ? ov.rate : Math.round(seed.rate * 100);
  const bonus = ov ? ov.bonus : seed.bonus;
  const commission = Math.round(seed.basis * (ratePct / 100));
  return { base, ratePct, bonus, commission, gig: seed.gig, total: base + seed.gig + commission + bonus };
}
