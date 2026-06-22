'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'info' | 'error';
type ToastItem = { id: number; message: string; type: ToastType };

const ToastCtx = createContext<((message: string, type?: ToastType) => void) | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex flex-col gap-2">
        {toasts.map((t) => {
          const icon = t.type === 'success' ? 'ph-check-circle' : t.type === 'error' ? 'ph-x-circle' : 'ph-info';
          const color = t.type === 'success' ? 'text-emerald-600' : t.type === 'error' ? 'text-rose-600' : 'text-primary';
          return (
            <div key={t.id} className="toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-xl">
              <i className={`ph-fill ${icon} text-lg ${color}`} />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
