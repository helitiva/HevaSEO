'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Centered popup dialog with a dark backdrop and enter/exit animation.
 * Children get a `close` callback so a submit handler can animate-close the dialog.
 * Rendered via a portal to <body> so a `transform`/`backdrop-filter` ancestor
 * (e.g. the sticky blurred header) can't trap its `position: fixed`.
 */
export function Modal({
  onClose, title, subtitle, icon, children,
}: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  children: (api: { close: () => void }) => ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 150);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-hidden tabIndex={-1} onClick={close} className={`${closing ? 'order-backdrop-out' : 'order-backdrop'} absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm`} />
      <div className={`${closing ? 'modal-out' : 'modal-in'} scrollbar-thin relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><i className={`ph-bold ${icon} text-lg`} /></span>}
            <div>
              <h3 className="display text-lg font-semibold tracking-tight">{title}</h3>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button onClick={close} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent"><i className="ph-bold ph-x" /></button>
        </div>
        <div className="mt-4">{children({ close })}</div>
      </div>
    </div>,
    document.body,
  );
}
