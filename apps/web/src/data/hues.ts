/**
 * Shared gradient-card hue tokens. Single source of truth for the pricing-card
 * look used by PricingGrid (CTA cards) and the order PackagePicker (radio cards),
 * so both stay visually identical. Class strings must stay literal for Tailwind's
 * content scanner — do not interpolate hue names.
 */
export type Hue = 'sky' | 'violet' | 'amber' | 'emerald' | 'rose';

export interface HueClasses {
  grad: string;
  gradPop: string;
  tile: string;
  note: string;
  pop: string;
  badge: string;
}

export const HUE: Record<Hue, HueClasses> = {
  sky: {
    grad: 'from-sky-100 via-sky-50 to-blue-100 dark:from-sky-950/60 dark:via-card dark:to-blue-950/40',
    gradPop: 'from-sky-200 via-sky-100 to-blue-200 dark:from-sky-900/60 dark:via-card dark:to-blue-900/40',
    tile: 'bg-sky-500 shadow-sky-500/30',
    note: 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    pop: 'shadow-sky-500/15 ring-sky-300/60 dark:ring-sky-500/30',
    badge: 'bg-sky-600 shadow-sky-600/30',
  },
  violet: {
    grad: 'from-violet-100 via-violet-50 to-fuchsia-100 dark:from-violet-950/60 dark:via-card dark:to-fuchsia-950/40',
    gradPop: 'from-violet-200 via-violet-100 to-fuchsia-100 dark:from-violet-900/60 dark:via-card dark:to-fuchsia-900/40',
    tile: 'bg-violet-500 shadow-violet-500/30',
    note: 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400',
    pop: 'shadow-violet-500/15 ring-violet-300/50 dark:ring-violet-500/30',
    badge: 'bg-violet-600 shadow-violet-600/30',
  },
  amber: {
    grad: 'from-amber-100 via-amber-50 to-orange-100 dark:from-amber-950/60 dark:via-card dark:to-orange-950/40',
    gradPop: 'from-amber-200 via-amber-100 to-orange-200 dark:from-amber-900/60 dark:via-card dark:to-orange-900/40',
    tile: 'bg-amber-500 shadow-amber-500/30',
    note: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    pop: 'shadow-amber-500/15 ring-amber-300/60 dark:ring-amber-500/30',
    badge: 'bg-amber-600 shadow-amber-600/30',
  },
  emerald: {
    grad: 'from-emerald-100 via-emerald-50 to-teal-100 dark:from-emerald-950/60 dark:via-card dark:to-teal-950/40',
    gradPop: 'from-emerald-200 via-emerald-100 to-teal-200 dark:from-emerald-900/60 dark:via-card dark:to-teal-900/40',
    tile: 'bg-emerald-500 shadow-emerald-500/30',
    note: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    pop: 'shadow-emerald-500/15 ring-emerald-300/60 dark:ring-emerald-500/30',
    badge: 'bg-emerald-600 shadow-emerald-600/30',
  },
  rose: {
    grad: 'from-rose-100 via-rose-50 to-pink-100 dark:from-rose-950/60 dark:via-card dark:to-pink-950/40',
    gradPop: 'from-rose-200 via-rose-100 to-pink-200 dark:from-rose-900/60 dark:via-card dark:to-pink-900/40',
    tile: 'bg-rose-500 shadow-rose-500/30',
    note: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    pop: 'shadow-rose-500/15 ring-rose-300/60 dark:ring-rose-500/30',
    badge: 'bg-rose-600 shadow-rose-600/30',
  },
};
