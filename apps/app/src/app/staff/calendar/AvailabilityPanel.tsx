'use client';

import { useState } from 'react';
import { WEEKDAYS } from '@/lib/calendar';
import { HANDOFF_META, HANDOFF_SCENARIOS, resolveHandoff } from '@/data/staffMock';
import type { StaffAvailability, AvailStatus, HandoffPolicy, TimeOff } from '@/data/staffMock';

const STATUS: Record<AvailStatus, { label: string; icon: string; color: string }> = {
  available: { label: 'Available', icon: 'ph-check-circle', color: 'text-emerald-500' },
  away: { label: 'Away', icon: 'ph-moon', color: 'text-muted-foreground' },
  focus: { label: 'Focus', icon: 'ph-headphones', color: 'text-primary' },
};
const clone = (a: StaffAvailability): StaffAvailability => JSON.parse(JSON.stringify(a));

export function AvailabilityPanel({ value, onSave, today }: { value: StaffAvailability; onSave: (next: StaffAvailability) => void; today: string }) {
  const [d, setD] = useState<StaffAvailability>(clone(value));
  const [toast, setToast] = useState('');
  const [off, setOff] = useState({ from: '', to: '', reason: '' });
  const dirty = JSON.stringify(d) !== JSON.stringify(value);

  const setHour = (day: number, patch: Partial<{ on: boolean; start: string; end: string }>) =>
    setD((p) => ({ ...p, hours: p.hours.map((h) => (h.day === day ? { ...h, ...patch } : h)) }));
  const addOff = () => {
    if (!off.from || !off.to || off.to < off.from) return;
    const entry: TimeOff = { id: `to${Date.now()}`, from: off.from, to: off.to, reason: off.reason.trim() || 'Time off' };
    setD((p) => ({ ...p, timeOff: [...p.timeOff, entry].sort((a, b) => (a.from < b.from ? -1 : 1)) }));
    setOff({ from: '', to: '', reason: '' });
  };
  const removeOff = (id: string) => setD((p) => ({ ...p, timeOff: p.timeOff.filter((t) => t.id !== id) }));
  const save = () => { onSave(clone(d)); setToast('Availability saved'); setTimeout(() => setToast(''), 1800); };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* status + working hours */}
      <div className="kcard">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-clock text-primary" /> Working hours</p>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {(Object.keys(STATUS) as AvailStatus[]).map((s) => (
            <button key={s} onClick={() => setD((p) => ({ ...p, status: s }))} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${d.status === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              <i className={`ph-bold ${STATUS[s].icon}`} />{STATUS[s].label}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          {d.hours.map((h) => (
            <div key={h.day} className="flex items-center gap-2 text-sm">
              <span className="w-9 shrink-0 font-medium">{WEEKDAYS[h.day]}</span>
              <button onClick={() => setHour(h.day, { on: !h.on })} role="switch" aria-checked={h.on} aria-label={`${WEEKDAYS[h.day]} working`} className={`relative h-5 w-9 shrink-0 rounded-full transition ${h.on ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${h.on ? 'left-[1.125rem]' : 'left-0.5'}`} /></button>
              {h.on ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <input type="time" value={h.start} onChange={(e) => setHour(h.day, { start: e.target.value })} className="rounded-md border border-border bg-background px-1.5 py-1 outline-none focus:border-primary" />
                  <span className="text-muted-foreground">–</span>
                  <input type="time" value={h.end} onChange={(e) => setHour(h.day, { end: e.target.value })} className="rounded-md border border-border bg-background px-1.5 py-1 outline-none focus:border-primary" />
                </div>
              ) : <span className="text-xs text-muted-foreground">Day off</span>}
            </div>
          ))}
        </div>
      </div>

      {/* time off */}
      <div className="kcard">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-airplane-takeoff text-primary" /> Time off</p>
        <div className="mb-3 space-y-1.5">
          {d.timeOff.length === 0 && <p className="text-xs text-muted-foreground">No time off scheduled.</p>}
          {d.timeOff.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
              <i className="ph-bold ph-calendar-x text-amber-500" />
              <span className="min-w-0 flex-1"><b className="font-medium">{t.reason}</b> <span className="text-xs text-muted-foreground">· {t.from} → {t.to}</span></span>
              <button onClick={() => removeOff(t.id)} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><i className="ph-bold ph-x" /></button>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-dashed border-border p-2.5">
          <div className="mb-2 flex flex-wrap gap-2">
            <label className="flex-1 text-[11px] font-semibold text-muted-foreground">From<input type="date" min={today} value={off.from} onChange={(e) => setOff((o) => ({ ...o, from: e.target.value }))} className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary" /></label>
            <label className="flex-1 text-[11px] font-semibold text-muted-foreground">To<input type="date" min={off.from || today} value={off.to} onChange={(e) => setOff((o) => ({ ...o, to: e.target.value }))} className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary" /></label>
          </div>
          <div className="flex gap-2">
            <input value={off.reason} onChange={(e) => setOff((o) => ({ ...o, reason: e.target.value }))} placeholder="Reason (optional)" className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary" />
            <button onClick={addOff} disabled={!off.from || !off.to} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"><i className="ph-bold ph-plus" /> Add</button>
          </div>
        </div>
      </div>

      {/* handoff policy + preview */}
      <div className="kcard lg:col-span-2">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-arrows-split text-primary" /> When I’m away — how should my new tasks be routed?</p>
        <p className="mb-3 text-xs text-muted-foreground">The system weighs how urgent the service is against how attached the customer is to working with you.</p>
        <div className="grid gap-2 md:grid-cols-3">
          {(Object.keys(HANDOFF_META) as HandoffPolicy[]).map((k) => { const m = HANDOFF_META[k]; const on = d.handoff === k; return (
            <button key={k} onClick={() => setD((p) => ({ ...p, handoff: k }))} className={`rounded-xl border p-3 text-left transition ${on ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-primary/40'}`}>
              <p className="flex items-center gap-1.5 text-sm font-semibold"><i className={`ph-bold ${m.icon} ${on ? 'text-primary' : ''}`} />{m.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.blurb}</p>
            </button>
          ); })}
        </div>

        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><i className="ph-bold ph-eye text-primary" /> How it plays out</p>
          <div className="space-y-1.5">
            {HANDOFF_SCENARIOS.map((sc) => { const r = resolveHandoff(d.handoff, sc.urgent, sc.loyal); return (
              <div key={sc.label} className="flex items-center gap-2 text-xs">
                <i className={`ph-bold ${sc.urgent ? 'ph-fire text-destructive' : sc.loyal ? 'ph-heart text-rose-500' : 'ph-user'} shrink-0`} />
                <span className="min-w-0 flex-1 truncate">{sc.label}</span>
                <span className={`shrink-0 rounded-md px-2 py-0.5 font-semibold ${r === 'reassign' ? 'bg-primary/10 text-primary' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                  {r === 'reassign' ? '→ reassign to a teammate' : '⏳ hold for you'}
                </span>
              </div>
            ); })}
          </div>
        </div>

        {dirty && (
          <div className="modal-in mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium"><i className="ph-fill ph-warning-circle mr-1 text-amber-500" />Unsaved changes</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setD(clone(value))} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Discard</button>
              <button onClick={save} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">Save</button>
            </div>
          </div>
        )}
      </div>

      {toast && <div className="toast-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">{toast}</div>}
    </div>
  );
}
