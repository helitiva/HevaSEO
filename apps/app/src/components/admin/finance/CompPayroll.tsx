'use client';

import { useState, useTransition } from 'react';
import { money } from '@/data/adminMock';
import { setStaffCompAction } from '@/app/admin/finance/comp.actions';
import type { CompLine, PayrollPreview } from '@/data/adminComp.server';

/**
 * Set a person's pay and see what this period actually owes them. Commission is computed on the same ASC 606
 * basis as revenue — an order counts on the day it was DELIVERED — so payroll can never run ahead of what
 * the business has earned.
 */
export function CompPayroll({ preview }: { preview: PayrollPreview }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <i className="ph-bold ph-wallet text-primary" aria-hidden /> Compensation & payroll
        </p>
        <span className="text-xs text-muted-foreground">{preview.period}</span>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Commission is a % of the order value each person earned this period — counted on the day the work was
        <b className="text-foreground"> delivered</b> (ASC 606), so we never pay out on unearned revenue.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="p-2">Person</th><th className="p-2">Role</th>
              <th className="p-2 text-right">Base</th><th className="p-2 text-right">Rate</th>
              <th className="p-2 text-right">Earned basis</th><th className="p-2 text-right">Commission</th>
              <th className="p-2 text-right">Total</th><th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((l) => (
              <Row key={l.profileId} line={l} editing={editing === l.profileId}
                onEdit={() => setEditing(l.profileId)} onClose={() => setEditing(null)} onSaved={flash} />
            ))}
            {preview.lines.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No staff or managers yet.</td></tr>
            )}
          </tbody>
          {preview.lines.length > 0 && (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="p-2" colSpan={2}>Total payroll</td>
                <td className="p-2 text-right">{money(preview.totals.base)}</td>
                <td className="p-2" />
                <td className="p-2 text-right text-muted-foreground">{money(preview.totals.basis)}</td>
                <td className="p-2 text-right">{money(preview.totals.commission)}</td>
                <td className="p-2 text-right">{money(preview.totals.total)}</td>
                <td className="p-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {toast && <p className="mt-2 text-xs font-medium text-emerald-600">{toast}</p>}
    </div>
  );
}

function Row({ line, editing, onEdit, onClose, onSaved }: {
  line: CompLine; editing: boolean; onEdit: () => void; onClose: () => void; onSaved: (m: string) => void;
}) {
  const [base, setBase] = useState(String(line.baseSalary));
  const [pct, setPct] = useState(String(line.commissionPct));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setErr(null);
    start(async () => {
      const res = await setStaffCompAction(line.profileId, Number(base), Number(pct));
      if (!res.ok) { setErr(res.error); return; }
      onSaved(`${line.name}: base ${money(Number(base))} · ${pct}% commission saved`);
      onClose();
    });
  };

  const inp = 'w-24 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs outline-none focus:border-primary';
  return (
    <tr className="border-b border-border/50">
      <td className="p-2 font-medium">{line.name}</td>
      <td className="p-2"><span className={`pill ${line.role === 'manager' ? 'pill-warn' : 'pill-good'}`}>{line.role}</span></td>
      {editing ? (
        <>
          <td className="p-2 text-right"><input type="number" min={0} value={base} onChange={(e) => setBase(e.target.value)} className={inp} /></td>
          <td className="p-2 text-right"><input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className={inp} /></td>
          <td className="p-2 text-right text-muted-foreground">{money(line.basis)}</td>
          <td className="p-2 text-right text-muted-foreground">—</td>
          <td className="p-2 text-right text-muted-foreground">—</td>
          <td className="p-2">
            <div className="flex items-center justify-end gap-1.5">
              <button onClick={save} disabled={pending} className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button>
              <button onClick={onClose} className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold">Cancel</button>
            </div>
            {err && <p role="alert" className="mt-1 text-right text-[10px] text-destructive">{err}</p>}
          </td>
        </>
      ) : (
        <>
          <td className="p-2 text-right">{line.configured ? money(line.baseSalary) : <span className="text-muted-foreground">not set</span>}</td>
          <td className="p-2 text-right">{line.commissionPct}%</td>
          <td className="p-2 text-right" title={`${line.orders} order${line.orders === 1 ? '' : 's'} delivered this period`}>{money(line.basis)}</td>
          <td className="p-2 text-right">{money(line.commission)}</td>
          <td className="p-2 text-right font-semibold">{money(line.total)}</td>
          <td className="p-2 text-right">
            <button onClick={onEdit} className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-accent">Set pay</button>
          </td>
        </>
      )}
    </tr>
  );
}
