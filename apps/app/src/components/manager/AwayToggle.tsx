'use client';

import { ManagerToggle } from './ManagerToggle';
import { setAwayAutoAssignAction } from '@/app/manager/modes.actions';

/**
 * Away → auto-assign switch. While ON the manager is marked away and newly placed pod-serviceable orders
 * route themselves to the least-loaded suitable staffer; flipping it on also sweeps the unassigned queue.
 */
export function AwayToggle({ initialOn }: { initialOn: boolean }) {
  return (
    <ManagerToggle
      initialOn={initialOn}
      ariaLabel="Auto-assign orders while away"
      icon="ph-airplane" iconOn="ph-airplane-tilt"
      label="Auto-assign" labelOn="Away · auto-assign"
      title="Turn on to auto-assign new orders while you’re away."
      titleOn="Away — new orders auto-assign to your pod. Click to turn off."
      tone="amber"
      onCommit={async (next) => {
        const res = await setAwayAutoAssignAction(next);
        if (!res.ok) return res;
        if (!res.on) return { ok: true, message: 'Away off · you’re back — new orders wait for you' };
        return {
          ok: true,
          message: res.assigned > 0
            ? `Away on · auto-assigned ${res.assigned} order${res.assigned > 1 ? 's' : ''} to your pod`
            : 'Away on · new orders will auto-assign to your pod',
        };
      }}
    />
  );
}
