'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import type { Broadcast } from '@/data/broadcasts';
import { markBroadcastReadAction, markBroadcastClickAction, markBroadcastDismissedAction } from './receipts.actions';

// Lane C inc-C4/C6 — carries the signed-in user's REAL broadcasts + read-receipt state (fetched
// server-side in each portal layout) down to the recipient store hooks. broadcasts feed the inbox/bell/
// banner source; readIds + the mark* mutators drive the real read state (broadcast_events) with
// optimistic UI. When this context is absent the hooks fall back to the localStorage mock.
type Ctx = {
  broadcasts: Broadcast[];
  readIds: string[];
  dismissedIds: string[];
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  markUnread: (id: string) => void;
  markClicked: (id: string) => void;
  markDismissed: (id: string) => void;
};
const BroadcastContext = createContext<Ctx | null>(null);

export function BroadcastProvider({ broadcasts, readIds: initial, dismissedIds: initialDismissed = [], children }: { broadcasts: Broadcast[]; readIds: string[]; dismissedIds?: string[]; children: React.ReactNode }) {
  const [readIds, setReadIds] = useState<string[]>(initial);
  const [dismissedIds, setDismissedIds] = useState<string[]>(initialDismissed);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    void markBroadcastReadAction(id);
  }, []);
  const markAllRead = useCallback((ids: string[]) => {
    setReadIds((prev) => [...new Set([...prev, ...ids])]);
    void Promise.all(ids.map((id) => markBroadcastReadAction(id)));
  }, []);
  // append-only events have no "un-read" — optimistic-local only (reverts on reload), a minor affordance.
  const markUnread = useCallback((id: string) => setReadIds((prev) => prev.filter((x) => x !== id)), []);
  const markClicked = useCallback((id: string) => {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    void markBroadcastClickAction(id);
  }, []);
  // dismiss is durable per-account (also implies read); optimistic so the banner hides instantly
  const markDismissed = useCallback((id: string) => {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    void markBroadcastDismissedAction(id);
  }, []);

  return <BroadcastContext.Provider value={{ broadcasts, readIds, dismissedIds, markRead, markAllRead, markUnread, markClicked, markDismissed }}>{children}</BroadcastContext.Provider>;
}

export function useBroadcastSource(): Broadcast[] | null {
  return useContext(BroadcastContext)?.broadcasts ?? null;
}
export function useBroadcastReceipts(): Ctx | null {
  return useContext(BroadcastContext);
}
