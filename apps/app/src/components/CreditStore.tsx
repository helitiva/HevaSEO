'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CREDIT_BALANCE, TRANSACTIONS, INVOICES, type CreditTx, type Invoice } from '@/data/mock';

type CreditCtx = {
  balance: number;
  transactions: CreditTx[];
  invoices: Invoice[];
  /** Add credit (used by the top-up form) — records a transaction + issues an invoice. */
  topUp: (amount: number, description: string) => void;
  /** Debit credit (e.g. when an order is placed). */
  charge: (amount: number, description: string) => void;
};

const Ctx = createContext<CreditCtx | null>(null);

const todayUS = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
};

export function CreditProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState(CREDIT_BALANCE);
  const [transactions, setTransactions] = useState<CreditTx[]>(TRANSACTIONS);
  const [invoices, setInvoices] = useState<Invoice[]>(INVOICES);

  const value = useMemo<CreditCtx>(() => ({
    balance,
    transactions,
    invoices,
    topUp: (amount, description) => {
      if (!(amount > 0)) return;
      const date = todayUS();
      setBalance((b) => b + amount);
      setTransactions((prev) => [{ date, description, type: 'topup', amount, status: 'success' }, ...prev]);
      setInvoices((prev) => {
        const max = prev.reduce((m, i) => { const n = Number(i.no.split('-').pop()); return Number.isFinite(n) ? Math.max(m, n) : m; }, 0);
        return [{ no: `HD-${new Date().getFullYear()}-${String(max + 1).padStart(3, '0')}`, date, amount, status: 'issued' }, ...prev];
      });
    },
    charge: (amount, description) => {
      if (!(amount > 0)) return;
      setBalance((b) => b - amount);
      setTransactions((prev) => [{ date: todayUS(), description, type: 'order', amount: -amount, status: 'success' }, ...prev]);
    },
  }), [balance, transactions, invoices]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCredit() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCredit must be used within CreditProvider');
  return c;
}
