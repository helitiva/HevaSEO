'use client';
import { createContext, useContext } from 'react';
import type { Broadcast } from '@/data/broadcasts';

// Lane C inc-C4 — carries the signed-in user's REAL broadcasts (fetched server-side in each portal
// layout via getMyBroadcasts) down to the recipient store hooks (useInbox/useBanners/useSiteAlerts).
// When this context provides a list, the store uses it as the source instead of the mock seeds; when
// it's null (not wrapped), the hooks fall back to the localStorage mock. Read/dismiss/ack state stays
// client-side regardless (real receipts = a later increment).
const BroadcastSourceContext = createContext<Broadcast[] | null>(null);

export function BroadcastProvider({ broadcasts, children }: { broadcasts: Broadcast[]; children: React.ReactNode }) {
  return <BroadcastSourceContext.Provider value={broadcasts}>{children}</BroadcastSourceContext.Provider>;
}

export function useBroadcastSource(): Broadcast[] | null {
  return useContext(BroadcastSourceContext);
}
