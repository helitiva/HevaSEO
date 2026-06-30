'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import type { Broadcast } from '@/data/broadcasts';
import { markBroadcastReadAction, markBroadcastClickAction } from './receipts.actions';

// Lane C inc-C4/C6 — carries the signed-in user's REAL broadcasts + read-receipt state (fetched
// server-side in each portal layout) down to the recipient store hooks. broadcasts feed the inbox/bell/
// banner source; readIds + the mark* mutators drive the real read state (broadcast_events) with
// optimistic UI. When this context is absent the hooks fall back to the localStorage mock.
type Ctx = {
  broadcasts: Broadcast[];
  readIds: string[];
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  markUnread: (id: string) => void;
  markClicked: (id: string) => void;
};
const BroadcastContext = createContext<Ctx | null>(null);

export function BroadcastProvider({ broadcasts, readIds: initial, children }: { broadcasts: Broadcast[]; readIds: string[]; children: React.ReactNode }) {
  const [readIds, setReadIds] = useState<string[]>(initial);

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

  return <BroadcastContext.Provider value={{ broadcasts, readIds, markRead, markAllRead, markUnread, markClicked }}>{children}</BroadcastContext.Provider>;
}

export function useBroadcastSource(): Broadcast[] | null {
  return useContext(BroadcastContext)?.broadcasts ?? null;
}
export function useBroadcastReceipts(): Ctx | null {
  return useContext(BroadcastContext);
}
