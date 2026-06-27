'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from './Toast';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'normal', label: 'Normal' },
  { key: 'urgent', label: 'Urgent' },
];

export function TicketForm({ onSubmit }: { onSubmit?: (subject: string, type: string) => void }) {
  const [prio, setPrio] = useState('normal');
  const [svc, setSvc] = useState('BLEN-1042');
  const [files, setFiles] = useState<string[]>([]);
  const toast = useToast();

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const subject = String(fd.get('subject') ?? '').trim();
    if (!subject) return;
    const type = String(fd.get('type') ?? 'Other');
    onSubmit?.(subject, type);
    toast("Ticket submitted — we'll reply within business hours");
    form.reset();
    setPrio('normal');
    setSvc('BLEN-1042');
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
          <select name="project" className="field">
            <option>hevashop.com</option>
            <option>clinicpro.com</option>
            <option>anphat.com</option>
            <option>Not project-related</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="lbl">Related service</label>
        <select className="field" value={svc} onChange={(e) => setSvc(e.target.value)}>
          <option value="BLEN-1042">#BLEN-1042 · Entity Growth — hevashop.com</option>
          <option value="IDX-1035">#IDX-1035 · Indexer Pro — hevashop.com</option>
          <option value="CT-1033">#CT-1033 · Content SEO/GEO x30 — hevashop.com</option>
          <option value="BLPR-1034">#BLPR-1034 · Press backlinks — anphat.com</option>
          <option value="__id">Enter another service code…</option>
          <option value="none">Not service-related</option>
        </select>
        {svc === '__id' && <input className="field mt-2" placeholder="Enter a service code, e.g. BLGP-1099 (see the code table on the FAQ page)" />}
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
          <i className="ph-bold ph-paperclip" />
          <span>{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} attached` : 'Drag & drop or click to upload screenshots, files…'}</span>
          <input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))} />
        </label>
        {files.length > 0 && <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{files.join(', ')}</p>}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">You&apos;ll get updates by email &amp; dashboard notifications.</p>
        <button type="submit" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[.98]">
          <i className="ph-bold ph-paper-plane-tilt" /> Submit ticket
        </button>
      </div>
    </form>
  );
}
