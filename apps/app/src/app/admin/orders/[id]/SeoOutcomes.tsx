import type { ReactNode } from 'react';
import type { AdminOrder } from '@/data/adminMock';

// Service-specific SEO result views (mock, illustrative per service type).
export function SeoOutcomes({ order }: { order: AdminOrder }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-line-up text-primary" /> SEO outcomes</p>
        <button className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-download-simple" /> Report</button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Organic traffic" value="+38%" tone="good" />
        <Metric label="Avg position" value="▲ 6.4" tone="good" />
        <Metric label="Keywords top-10" value="12" />
        <Metric label="Indexed" value="92%" />
      </div>
      {byService(order.service)}
    </div>
  );
}

function byService(service: string): ReactNode {
  switch (service) {
    case 'Keyword':
      return (
        <Table head={['Keyword', 'Vol', 'Before', 'After', 'Δ']} rows={[
          ['best running shoes', '8.1k', '#28', '#9', up(19)],
          ['trail shoes flat feet', '2.4k', '#41', '#14', up(27)],
          ['marathon shoe guide', '1.2k', '—', '#22', up(0, 'new')],
        ]} />
      );
    case 'Backlink':
      return (
        <Table head={['Linking domain', 'DR', 'Type', 'Status']} rows={[
          ['techreview.io', '74', 'Guest post', pill('Indexed', 'live')],
          ['seoblog.net', '61', 'Editorial', pill('Indexed', 'live')],
          ['startuphub.co', '58', 'Resource', pill('Pending', 'warn')],
          ['nichewire.com', '52', 'Guest post', pill('Indexed', 'live')],
        ]} note="18 of 20 links built · 16 indexed (89%)" />
      );
    case 'Content':
      return (
        <Table head={['Article', 'Words', 'Target keyword', 'Status']} rows={[
          ['How to choose running shoes', '1,840', 'choose running shoes', pill('Published', 'live')],
          ['Flat feet shoe guide', '2,110', 'flat feet shoes', pill('Published', 'live')],
          ['Marathon prep checklist', '1,560', 'marathon prep', pill('Draft', 'warn')],
        ]} note="10 articles · 18,400 words delivered" />
      );
    case 'Optimization':
      return (
        <Table head={['Core Web Vital', 'Before', 'After', 'Δ']} rows={[
          ['LCP', '4.2s', '1.9s', up(0, '−55%')],
          ['INP', '320ms', '140ms', up(0, '−56%')],
          ['CLS', '0.21', '0.04', up(0, 'good')],
          ['PageSpeed', '52', '94', up(42)],
        ]} />
      );
    case 'Audit':
      return (
        <Table head={['Area', 'Issues found', 'Critical', 'Status']} rows={[
          ['Technical', '23', '4', pill('Reported', 'live')],
          ['On-page', '31', '2', pill('Reported', 'live')],
          ['Content', '12', '1', pill('Reported', 'live')],
          ['Backlinks', '8', '0', pill('Reported', 'live')],
        ]} note="74 issues · 7 critical · roadmap delivered" />
      );
    case 'Indexer':
      return (
        <Table head={['Batch', 'Links', 'Indexed', 'Rate']} rows={[
          ['Batch #1', '500', '472', '94%'],
          ['Batch #2', '500', '441', '88%'],
        ]} note="1,000 links submitted · 913 indexed (91%)" />
      );
    default:
      return (
        <Table head={['Page', 'Status', 'Score']} rows={[
          ['Homepage', pill('Live', 'live'), '96'],
          ['Service pages (5)', pill('Live', 'live'), '93'],
        ]} note="Delivered & deployed" />
      );
  }
}

function up(delta: number, label?: string): ReactNode {
  return <span className="font-semibold text-emerald-500">{label ?? `▲ ${delta}`}</span>;
}
function pill(text: string, tone: 'live' | 'warn'): ReactNode {
  return <span className={`pill ${tone === 'live' ? 'pill-live' : 'pill-warn'}`}>{text}</span>;
}
function Metric({ label, value, tone }: { label: string; value: string; tone?: 'good' }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className={`display text-xl font-bold leading-none ${tone === 'good' ? 'text-emerald-500' : ''}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
function Table({ head, rows, note }: { head: string[]; rows: ReactNode[][]; note?: string }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">{head.map((h, i) => <th key={i} className={`p-2.5 ${i >= 2 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b border-border/50 last:border-0">
                {r.map((c, ci) => <td key={ci} className={`p-2.5 ${ci >= 2 ? 'text-right' : ''}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
