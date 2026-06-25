'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { TopUp } from './TopUp';
import { useCredit } from './CreditStore';

/** Header balance pill — click to quick top-up (amount + payment method, in-modal). */
export function CreditButton() {
  const [open, setOpen] = useState(false);
  const { balance } = useCredit();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Top up credits"
        className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold transition hover:border-primary/50 hover:bg-accent sm:flex"
      >
        <i className="ph-bold ph-wallet text-primary" /> ${balance.toLocaleString('en-US')}
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} title="Top up credits" subtitle={`Current balance $${balance.toLocaleString('en-US')}`} icon="ph-wallet">
          {({ close }) => <TopUp embedded onDone={close} />}
        </Modal>
      )}
    </>
  );
}
