'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ORDERS, STATUSES, folderPathForDomain, type Order, type OrderStatus } from '@/data/mock';
import { OrdersBoard } from '@/components/OrdersBoard';
import { QuickOrderButton } from '@/components/QuickOrderButton';
import { useOrdersStore } from '@/components/OrdersStore';
import { useProjects } from '@/components/ProjectsStore';

const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
function favColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function initials(domain: string) {
  const name = domain.replace(/\.(com|net|org|io|vn)$/i, '');
  const parts = name.split(/[.\-]/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase();
}

const STATUS_PILL: Record<'planned' | 'progress' | 'completed', { label: string; color: string }> = {
  planned: { label: 'Planning', color: '#94a3b8' },
  progress: { label: 'In progress', color: '#2563eb' },
  completed: { label: 'Completed', color: '#10b981' },
};

export default function ProjectDetailPage() {
  const id = useParams().id as string;
  const { addedOrders, statusOverrides } = useOrdersStore();
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground"><i className="ph-bold ph-folder-dashed text-xl" aria-hidden /></span>
        <p className="mt-3 font-semibold">Project not found</p>
        <Link href="/projects" className="mt-1 text-sm text-primary hover:underline">← Back to projects</Link>
      </div>
    );
  }

  const effStatus = (o: Order): OrderStatus => statusOverrides[o.id] ?? o.status;
  const orders = [...addedOrders, ...ORDERS].filter((o) => o.domain === project.domain);
  const count = (s: OrderStatus) => orders.filter((o) => effStatus(o) === s).length;
  const totalCost = orders.reduce((a, o) => a + o.cost, 0);
  const path = folderPathForDomain(project.domain);
  const sp = STATUS_PILL[project.status];

  const Stat = ({ label, value, color }: { label: string; value: number; color?: string }) => (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} /> : <i className="ph-bold ph-stack text-muted-foreground" aria-hidden />}
      <span className="text-muted-foreground">{label}</span>
      <b className="font-semibold text-foreground">{value}</b>
    </span>
  );

  return (
    <>
      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/projects" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent" aria-label="Back to projects">
          <i className="ph-bold ph-arrow-left" aria-hidden />
        </Link>
        <nav className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          {path.map((f) => (
            <span key={f.id} className="flex items-center gap-1.5">
              <i className="ph-bold ph-caret-right text-[10px] text-muted-foreground/60" aria-hidden />
              <span style={{ color: f.color }}>{f.name}</span>
            </span>
          ))}
          <i className="ph-bold ph-caret-right text-[10px] text-muted-foreground/60" aria-hidden />
          <span className="font-semibold text-foreground">{project.domain}</span>
        </nav>
      </div>

      {/* project header */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: favColor(project.domain) }}>{initials(project.domain)}</span>
          <h1 className="display text-xl font-semibold tracking-tight">{project.domain}</h1>
          <a href={`https://${project.domain}`} target="_blank" rel="noopener noreferrer" title="Visit site" aria-label="Visit site" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"><i className="ph-bold ph-arrow-square-out" aria-hidden /></a>
          <span className="pill" style={{ background: `${sp.color}1f`, color: sp.color }}>● {sp.label}</span>
          <QuickOrderButton label="Order a service" projectDomain={project.domain} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:bg-primary/90 active:scale-[.98]" />
        </div>

        <p className="mt-3 flex gap-1.5 text-sm text-muted-foreground">
          <i className="ph-bold ph-note-pencil mt-0.5 shrink-0" aria-hidden />
          <span>{project.note}</span>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4">
          <Stat label="Total orders" value={orders.length} />
          <Stat label="Planned" value={count('planned')} color={STATUSES.planned.color} />
          <Stat label="In progress" value={count('progress')} color={STATUSES.progress.color} />
          <Stat label="In review" value={count('review')} color={STATUSES.review.color} />
          <Stat label="Completed" value={count('completed')} color={STATUSES.completed.color} />
          <span className="inline-flex items-center gap-1.5 text-sm sm:ml-auto">
            <i className="ph-bold ph-wallet text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Total cost</span>
            <b className="font-semibold text-foreground">${totalCost.toLocaleString('en-US')}</b>
          </span>
        </div>
      </div>

      {/* orders for this project — reuses the board (List / Kanban / card design) */}
      <section className="mt-5">
        <OrdersBoard domain={project.domain} />
      </section>
    </>
  );
}
