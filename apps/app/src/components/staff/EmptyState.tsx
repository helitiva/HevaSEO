import Link from 'next/link';

export type EmptyKind = 'new-hire' | 'caught-up' | 'no-match';

interface Variant { icon: string; title: string; body: string; cta?: { label: string; href: string }; }

// Context-aware empty states. "No tasks found." is a design failure — every empty has warmth + a next action.
const VARIANTS: Record<EmptyKind, Variant> = {
  'new-hire': {
    icon: 'ph-confetti',
    title: 'Welcome aboard',
    body: 'No tasks assigned yet. Admin routes work to your skills — keep them up to date and you’ll be first in line.',
    cta: { label: 'Update skills & availability', href: '/staff/settings' },
  },
  'caught-up': {
    icon: 'ph-check-circle',
    title: 'You’re all clear',
    body: 'Nothing open right now. Nice work — go grab a coffee, or review what you’ve shipped.',
    cta: { label: 'Review submitted deliverables', href: '/staff/deliverables' },
  },
  'no-match': {
    icon: 'ph-funnel',
    title: 'No tasks match',
    body: 'Nothing fits the current filters.',
  },
};

// Which empty to show: a brand-new staffer (never had a task) vs. just cleared the board.
export function emptyKindFor(everHadTasks: boolean): EmptyKind {
  return everHadTasks ? 'caught-up' : 'new-hire';
}

export function EmptyState({ kind }: { kind: EmptyKind }) {
  const v = VARIANTS[kind];
  return (
    <div className="kcard flex flex-col items-center gap-3 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <i className={`ph-bold ${v.icon} text-2xl`} aria-hidden />
      </span>
      <div>
        <p className="display text-lg font-bold">{v.title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{v.body}</p>
      </div>
      {v.cta && (
        <Link href={v.cta.href} className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          {v.cta.label}
        </Link>
      )}
    </div>
  );
}
