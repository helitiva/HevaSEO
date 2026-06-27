'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function SlideOver({ open, onClose, title, children, widthClass = 'max-w-md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; widthClass?: string }) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  // Lock body scroll, close on Escape, and trap focus within the panel while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  // Portal to <body> so the overlay escapes the page-transition stagger and any
  // transformed/overflow ancestors — it always renders full-height from the top.
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div onClick={onClose} className="order-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`order-panel scrollbar-thin absolute inset-y-0 right-0 w-full ${widthClass} overflow-y-auto border-l border-border bg-card p-5 shadow-2xl outline-none`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-x" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
