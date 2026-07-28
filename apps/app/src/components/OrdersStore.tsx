'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { commentsFor, type Order, type OrderComment, type OrderStatus } from '@/data/mock';

type OrdersCtx = {
  statusOverrides: Record<string, OrderStatus>;
  setStatus: (id: string, status: OrderStatus) => void;
  extraComments: Record<string, OrderComment[]>;
  addComment: (id: string, text: string) => void;
  /** Orders placed this session (e.g. from the Services flow), newest first. */
  addedOrders: Order[];
  addOrder: (order: Order) => void;
  /** The signed-in customer's REAL orders (getMyOrders), so the detail slide-over resolves by id. */
  realOrders: Order[];
};

const Ctx = createContext<OrdersCtx | null>(null);

/** Client-side store so panel edits (status, comments) and placed orders reflect on the board without a backend. */
export function OrdersProvider({ children, initialOrders = [] }: { children: ReactNode; initialOrders?: Order[] }) {
  const [statusOverrides, setStatusOverrides] = useState<Record<string, OrderStatus>>({});
  const [extraComments, setExtraComments] = useState<Record<string, OrderComment[]>>({});
  const [addedOrders, setAddedOrders] = useState<Order[]>([]);

  const value = useMemo<OrdersCtx>(() => ({
    statusOverrides,
    extraComments,
    addedOrders,
    realOrders: initialOrders,
    setStatus: (id, status) => setStatusOverrides((m) => ({ ...m, [id]: status })),
    addComment: (id, text) =>
      setExtraComments((m) => ({
        ...m,
        [id]: [...(m[id] ?? []), { author: 'Huy', initials: 'HV', text, time: 'just now' }],
      })),
    addOrder: (order) => setAddedOrders((list) => [order, ...list]),
  }), [statusOverrides, extraComments, addedOrders, initialOrders]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrdersStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOrdersStore must be used within OrdersProvider');
  return ctx;
}

/** Effective status = override (from a panel edit) or the order's base status. */
export function useEffectiveStatus(id: string, base: OrderStatus): OrderStatus {
  return useOrdersStore().statusOverrides[id] ?? base;
}

/** Seed comments + any added in this session. */
export function useComments(id: string): OrderComment[] {
  const { extraComments } = useOrdersStore();
  return [...commentsFor(id), ...(extraComments[id] ?? [])];
}
