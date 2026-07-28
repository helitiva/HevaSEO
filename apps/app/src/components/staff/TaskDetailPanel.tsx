'use client';

// Shared rich task-detail panel — task summary + the client dossier (tier, history, who handled
// them, note) + the customer's checkout brief. Used inside a SlideOver from both the calendar
// timeline and the tasks board. Links out to the full task page; never navigates on its own.
import { serviceMeta, clientSummary, type ClientSummary } from '@/data/staffMock';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { CareTags } from '@/components/staff/CareTags';
import { TIER } from '@/data/adminMock';
import { daysToDue, slaChip } from '@/lib/staff';
import type { OrderStatus, Priority } from '@/data/staffMock';

export interface PanelTask {
  id: string; code: string; service: string; customer: string;
  status: OrderStatus; priority: Priority; deadline: string | null;
  pkg?: string; start?: string; brief?: { label: string; value: string }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DONE = new Set<OrderStatus>(['approved', 'delivered', 'completed']);
const SLA_TONE: Record<string, string> = {
  bad: 'bg-destructive/15 text-destructive',
  warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  soft: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  neutral: 'bg-primary/10 text-primary',
};
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const diffD = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / 86400000);
const fmtShort = (iso: string) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const initialsOf = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const hueOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

export function TaskDetailPanel({ task: t, today, client: clientProp }: { task: PanelTask; today: string; client?: ClientSummary }) {
  const meta = serviceMeta(t.service);
  const done = DONE.has(t.status);
  const deadline = t.deadline;
  const start = t.start && deadline && t.start <= deadline ? t.start : deadline;
  const span = start && deadline ? Math.max(1, diffD(start, deadline) + 1) : null;
  const overdue = !done && !!deadline && deadline < today;
  const sla = !done && deadline ? slaChip(daysToDue(deadline, today)) : null;
  // Real client dossier passed in (tasks board); the mock summary is only the fallback (calendar).
  const client = clientProp ?? clientSummary(t.customer);
  return (
    <div className="space-y-4">
      {/* task summary */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${meta.color}1f`, color: meta.color }}><i className={`ph-bold ${meta.icon} text-xl`} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.service}{t.pkg ? ` · ${t.pkg}` : ''}</p>
            <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{t.code}</span> · {t.customer}</p>
          </div>
          <StatusBadge status={t.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={t.priority} />
          {sla && <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SLA_TONE[sla.tone]}`}>{sla.label}</span>}
          <CareTags company={t.customer} />
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {start && deadline ? <>{fmtShort(start)} → <span className={overdue ? 'font-semibold text-rose-500' : 'text-foreground'}>{fmtShort(deadline)}</span> · {span}d</> : 'No deadline set'}
          </span>
        </div>
      </div>

      <ClientCard client={client} />
      {t.brief && t.brief.length > 0 && <BriefCard fields={t.brief} />}

      <a href={`/staff/tasks/${t.id}`} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
        <i className="ph-bold ph-arrow-square-out" aria-hidden />Open full task
      </a>
    </div>
  );
}

function ClientCard({ client }: { client: ClientSummary }) {
  const tm = client.tier ? TIER[client.tier] : null;
  const max = Math.max(1, ...client.byService.map((s) => s.count));
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-buildings text-primary" aria-hidden /> Client</p>
        <span className="truncate text-sm text-muted-foreground">{client.company}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {tm && <span className="pill" style={{ background: `${tm.color}1f`, color: tm.color }}><i className={`ph-fill ${tm.icon}`} aria-hidden />{tm.label} Tier</span>}
        {client.since && <span className="text-muted-foreground">client since {client.since}</span>}
        {client.tags.map((tag) => <span key={tag} className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{tag}</span>)}
      </div>
      <p className="mt-3 text-sm text-muted-foreground"><span className="text-lg font-bold text-foreground">{client.orders}</span> orders placed{client.topService && <> · mostly <b className="text-foreground">{client.topService}</b></>}</p>
      {client.byService.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {client.byService.map((s) => { const m = serviceMeta(s.service);
            return (
              <div key={s.service} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-muted-foreground">{s.service}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: m.color }} /></div>
                <span className="w-5 text-right font-semibold">{s.count}</span>
              </div>
            );
          })}
        </div>
      )}
      {client.staff.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] text-muted-foreground">Previously handled by</p>
          <div className="flex flex-wrap gap-1.5">
            {client.staff.map((name) => { const h = hueOf(name);
              return <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2.5 text-xs font-medium"><span className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold" style={{ background: `hsl(${h} 65% 50% / 0.16)`, color: `hsl(${h} 55% 42%)` }} aria-hidden>{initialsOf(name)}</span>{name}</span>;
            })}
          </div>
        </div>
      )}
      {client.note && <p className="mt-3 flex gap-2 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground"><i className="ph-bold ph-note-pencil mt-0.5 shrink-0 text-primary" aria-hidden />{client.note}</p>}
    </div>
  );
}

function BriefCard({ fields }: { fields: { label: string; value: string }[] }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-clipboard-text text-primary" aria-hidden /> Customer brief</p>
        <span className="text-xs text-muted-foreground">{fields.length} fields · submitted at checkout</span>
      </div>
      <dl className="divide-y divide-border/40">{fields.map((f, i) => <BriefRow key={i} field={f} />)}</dl>
    </div>
  );
}
function BriefRow({ field }: { field: { label: string; value: string } }) {
  const { label, value } = field;
  const isUrl = /^https?:\/\//i.test(value);
  const isList = /keyword|anchor|topic|page|tag/i.test(label) && /[,;]/.test(value);
  return (
    <div className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground sm:w-28">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm">
        {isUrl ? <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">{value}</a>
          : isList ? <span className="flex flex-wrap gap-1.5">{value.split(/[,;]/).map((v) => v.trim()).filter(Boolean).map((v, i) => <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs">{v}</span>)}</span>
            : <span>{value}</span>}
      </dd>
    </div>
  );
}
