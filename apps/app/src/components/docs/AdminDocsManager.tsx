'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FORMAT_META, audienceMeta, audiencesOf, DISTRIBUTABLE_AUDIENCES,
  type DocAudience, type StaffDoc,
} from '@/data/staffDocs';
import { deleteDocAction } from '@/app/admin/docs/doc.actions';

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Admin docs control room (Lane C inc-C3): every real doc in the tenant library, who it's distributed
// to, and the controls to publish a new one, edit, or unpublish. All docs are admin-authored → editable.
export function AdminDocsManager({ docs }: { docs: StaffDoc[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<DocAudience | 'all'>('all');
  const [confirm, setConfirm] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const created = docs;

  const removeDoc = async (id: string) => {
    setBusy(true); setErr('');
    const res = await deleteDocAction(id);
    setBusy(false); setConfirm(null);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  };

  const shown = useMemo(
    () => (filter === 'all' ? docs : docs.filter((d) => audiencesOf(d).includes(filter))),
    [docs, filter],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of DISTRIBUTABLE_AUDIENCES) c[a] = docs.filter((d) => audiencesOf(d).includes(a)).length;
    return c;
  }, [docs]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Docs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Publish tutorials, guides & policies and distribute them to customers, staff or managers.</p>
        </div>
        <Link href="/admin/docs/new" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
          <i className="ph-bold ph-plus" aria-hidden /> New doc
        </Link>
      </div>

      {err && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{err}</p>}

      {/* distribution KPI strip */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Total docs" value={String(docs.length)} icon="ph-books" sub={`${created.length} by you`} />
        {DISTRIBUTABLE_AUDIENCES.slice(0, 4).map((a) => { const m = audienceMeta(a); return (
          <button key={a} onClick={() => setFilter(filter === a ? 'all' : a)} className={`rounded-xl border bg-card p-3 text-left transition hover:border-primary/40 ${filter === a ? 'border-primary' : 'border-border'}`}>
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{m.label}</span><i className={`ph-fill ${m.icon}`} style={{ color: m.color }} aria-hidden /></div>
            <p className="display mt-1 text-xl font-bold tracking-tight">{counts[a]}</p>
          </button>
        ); })}
      </div>

      {/* filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setFilter('all')} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${filter === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>All <span className="opacity-70">{docs.length}</span></button>
        {DISTRIBUTABLE_AUDIENCES.map((a) => { const m = audienceMeta(a); return (
          <button key={a} onClick={() => setFilter(filter === a ? 'all' : a)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${filter === a ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>
            <i className={`ph-bold ${m.icon}`} aria-hidden /> {m.label} <span className="opacity-70">{counts[a]}</span>
          </button>
        ); })}
      </div>

      {/* docs table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Doc</th><th className="p-3">Distributed to</th><th className="p-3">Format</th><th className="p-3">Updated</th><th className="p-3">Source</th><th className="w-px p-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.id} className="border-b border-border/50 transition hover:bg-muted/40">
                <td className="p-3">
                  <Link href={`/admin/docs/${d.id}`} className="font-semibold hover:text-primary hover:underline">{d.title}</Link>
                  {d.pinned && <i className="ph-fill ph-push-pin ml-1.5 text-amber-500" title="Pinned" aria-hidden />}
                  <p className="truncate text-[11px] text-muted-foreground">{d.summary}</p>
                </td>
                <td className="p-3">
                  <span className="flex flex-wrap gap-1">
                    {audiencesOf(d).map((a) => { const m = audienceMeta(a); return (
                      <span key={a} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${m.color}1a`, color: m.color }}><i className={`ph-fill ${m.icon}`} aria-hidden />{m.label}</span>
                    ); })}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground"><i className={`ph-bold ${FORMAT_META[d.format].icon} mr-1`} aria-hidden />{FORMAT_META[d.format].label}</td>
                <td className="p-3 text-muted-foreground">{fmtDate(d.updatedAt)}</td>
                <td className="p-3"><span className="pill pill-good">published</span></td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2.5">
                    <Link href={`/admin/docs/${d.id}`} title="View" aria-label="View" className="text-muted-foreground hover:text-foreground"><i className="ph-bold ph-eye" aria-hidden /></Link>
                    <Link href={`/admin/docs/${d.id}/edit`} title="Edit" aria-label="Edit" className="text-muted-foreground hover:text-foreground"><i className="ph-bold ph-pencil-simple" aria-hidden /></Link>
                    <button onClick={() => setConfirm({ id: d.id, title: d.title })} title="Unpublish" aria-label="Unpublish" className="text-muted-foreground hover:text-destructive"><i className="ph-bold ph-trash" aria-hidden /></button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No docs for this audience yet — <Link href="/admin/docs/new" className="font-semibold text-primary hover:underline">publish one</Link>.</td></tr>}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="modal-in relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="flex items-start gap-2 text-sm"><i className="ph-bold ph-warning-circle mt-0.5 text-amber-500" aria-hidden />Unpublish &ldquo;{confirm.title}&rdquo;? Its audiences will no longer see it.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
              <button disabled={busy} onClick={() => removeDoc(confirm.id)} className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Unpublish</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, icon, sub }: { label: string; value: string; icon: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} text-primary`} aria-hidden /></div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
