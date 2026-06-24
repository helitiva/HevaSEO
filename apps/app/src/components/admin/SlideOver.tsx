'use client';
export function SlideOver({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div onClick={onClose} className="order-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className="order-panel absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
