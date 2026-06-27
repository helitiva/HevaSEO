'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Centered modal — wider than the shared SlideOver, so the note editor reads like a classic
// document editor. Handles scroll-lock, Escape, backdrop click, and focus trap.
interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  widthClass?: string;
}

export function NoteModal({ open, onClose, children, ariaLabel, widthClass = 'max-w-3xl' }: Props) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

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
        panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[contenteditable],[tabindex]:not([tabindex="-1"])'),
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
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div onClick={onClose} className="order-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`modal-in relative my-auto w-full ${widthClass} overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
