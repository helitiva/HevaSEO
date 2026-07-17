'use client';

import { ManagerToggle } from './ManagerToggle';
import { setAutoReviewAction } from '@/app/manager/modes.actions';

/**
 * Auto-review switch. While ON the pod's submissions skip this manager's review queue: each one is approved
 * in their name the moment the staffer submits and goes straight to the customer — who still sees a normal
 * manager-reviewed delivery. Flipping it on also clears whatever is already waiting for review.
 */
export function AutoReviewToggle({ initialOn }: { initialOn: boolean }) {
  return (
    <ManagerToggle
      initialOn={initialOn}
      ariaLabel="Auto-approve pod submissions straight to the customer"
      icon="ph-clipboard-text" iconOn="ph-seal-check"
      label="Auto-review" labelOn="Auto-review on"
      title="Turn on to send your pod’s submissions straight to the customer, approved in your name."
      titleOn="Auto-review — submissions go straight to the customer, approved in your name. Click to turn off."
      tone="emerald"
      onCommit={async (next) => {
        const res = await setAutoReviewAction(next);
        if (!res.ok) return res;
        if (!res.on) return { ok: true, message: 'Auto-review off · submissions wait for your review' };
        return {
          ok: true,
          message: res.delivered > 0
            ? `Auto-review on · delivered ${res.delivered} waiting submission${res.delivered > 1 ? 's' : ''}`
            : 'Auto-review on · submissions go straight to the customer',
        };
      }}
    />
  );
}
