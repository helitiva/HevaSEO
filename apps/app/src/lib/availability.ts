// Pure availability logic — no React, no money. Unit-tested in availability.test.ts.
// Shared by the staff AvailabilityToggle, the staff topbar, and the admin override.

export type Availability = 'available' | 'busy' | 'ooo';

export interface AvailabilityMeta {
  value: Availability;
  label: string;
  icon: string;
  /** dot/text color token — semantic, works in light + dark via Tailwind classes */
  dot: string;
  text: string;
  ring: string;
}

export const AVAILABILITY: Availability[] = ['available', 'busy', 'ooo'];

const META: Record<Availability, AvailabilityMeta> = {
  available: {
    value: 'available', label: 'Available', icon: 'ph-circle-wavy-check',
    dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/40',
  },
  busy: {
    value: 'busy', label: 'Busy', icon: 'ph-hourglass-medium',
    dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/40',
  },
  ooo: {
    value: 'ooo', label: 'Out of office', icon: 'ph-moon',
    dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400', ring: 'ring-slate-400/40',
  },
};

export function availabilityMeta(value: Availability): AvailabilityMeta {
  return META[value];
}

// Short label for compact chips ("OOO" reads better than "Out of office" in a pill).
export function availabilityShort(value: Availability): string {
  return value === 'ooo' ? 'OOO' : META[value].label;
}

// Whether the router should consider this person for new work.
export function acceptsWork(value: Availability): boolean {
  return value === 'available';
}
