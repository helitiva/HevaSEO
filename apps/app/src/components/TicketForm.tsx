'use client';

import { useState, type FormEvent } from 'react';
import { useOrdersStore } from './OrdersStore';
import { useProjects } from './ProjectsStore';
import { SERVICES } from '@/data/mock';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'normal', label: 'Normal' },
  { key: 'urgent', label: 'Urgent' },
];
// form priority → DB order_priority
const PRIO_DB: Record<string, 'low' | 'med' | 'high'> = { low: 'low', normal: 'med', urgent: 'high' };

const NONE = '__none';

export function TicketForm({ onSubmit }: { onSubmit?: (subject: string, type: string, body: string, priority: 'low' | 'med' | 'high', orderCode?: string) => void }) {
  const { realOrders } = useOrdersStore();     // the customer's REAL orders (getMyOrders)
  const { projects } = useProjects();          // the customer's REAL projects
  const activeProjects = projects.filter((p) => !p.archived);
  const [prio, setPrio] = useState('normal');
  const [svc, setSvc] = useState(NONE);        // selected order code (the "Related service")
  const [files, setFiles] = useState<string[]>([]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const subject = String(fd.get('subject') ?? '').trim();
    if (!subject) return;
    const type = String(fd.get('type') ?? 'Other');
    // the detailed description IS the first message; fall back to the subject when left blank
    const body = String(fd.get('description') ?? '').trim() || subject;
    onSubmit?.(subject, type, body, PRIO_DB[prio] ?? 'med', svc === NONE ? undefined : svc);
    form.reset();
    setPrio('normal');
    setSvc(NONE);
    setFiles([]);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 lg:p-6">
      <h3 className="display text-lg font-semibold tracking-tight">Create a support ticket</h3>
      <p className="text-xs text-muted-foreground">The clearer your description, the faster an advisor can help.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="lbl">Issue type</label>
          <select name="type" className="field">
            <option value="Technical">Technical / Service issue</option>
            <option value="Billing">Billing &amp; Credit</option>
            <option value="Orders">Orders &amp; progress</option>
            <option value="Consultation">Service consultation</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="lbl">Related project</label>
          <select name="project" className="field" defaultValue={NONE}>
            <option value={NONE}>Not project-related</option>
            {activeProjects.map((p) => <option key={p.id} value={p.domain}>{p.name}{p.domain ? ` · ${p.domain}` : ''}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="lbl">Related service <span className="font-normal text-muted-foreground">(links the ticket to an order)</span></label>
        <select className="field" value={svc} onChange={(e) => setSvc(e.target.value)}>
          <option value={NONE}>Not service-related</option>
          {realOrders.map((o) => (
            <option key={o.id} value={o.id}>#{o.id} · {SERVICES[o.service].label} — {o.domain}</option>
          ))}
        </select>
        {realOrders.length === 0 && <p className="mt-1 text-[11px] text-muted-foreground">You don’t have any orders yet — leave this as “Not service-related”.</p>}
      </div>

      <div className="mt-4">
        <label className="lbl">Priority level</label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => {
            const on = prio === p.key;
            return (
              <button key={p.key} type="button" onClick={() => setPrio(p.key)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <label className="lbl">Subject</label>
        <input name="subject" required className="field" placeholder="e.g. Links not indexed after 5 days" />
      </div>

      <div className="mt-4">
        <label className="lbl">Detailed description</label>
        <textarea name="description" rows={4} className="field" placeholder="Describe the issue, what you've tried, related links/orders…" />
      </div>

      <div className="mt-4">
        <label className="lbl">Attachments <span className="font-normal text-muted-foreground">(optional)</span></label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground transition hover:border-primary/50">
          <i className="ph-bold ph-paperclip" aria-hidden />
          <span>{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} attached` : 'Drag & drop or click to upload screenshots, files…'}</span>
          <input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))} />
        </label>
        {files.length > 0 && <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{files.join(', ')}</p>}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">You&apos;ll get updates by email &amp; dashboard notifications.</p>
        <button type="submit" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[.98]">
          <i className="ph-bold ph-paper-plane-tilt" aria-hidden /> Submit ticket
        </button>
      </div>
    </form>
  );
}
