'use client';

import { useState } from 'react';

const BY_SERVICE: Record<string, string[]> = {
  Keyword: ['Seed research', 'Cluster & map', 'Competitor gap', 'Volume & difficulty', 'Deliver report'],
  Backlink: ['Prospect sites', 'Vet metrics (DR/traffic)', 'Outreach', 'Place links', 'Index & verify'],
  Content: ['Brief & outline', 'Draft articles', 'On-page SEO', 'Internal review', 'Publish'],
  Optimization: ['Audit baseline', 'Speed fixes', 'Schema & on-page', 'Core Web Vitals', 'Deploy & report'],
  Audit: ['Crawl site', 'Technical review', 'On-page review', 'Backlink review', 'Roadmap'],
  'Web Design': ['Wireframe', 'Design draft', 'Build', 'SEO setup', 'QA & deploy'],
  Indexer: ['Receive URLs', 'Submit to index', 'Retry pending', 'Status report'],
};
const DEFAULT = ['Confirm scope', 'Execute', 'Internal review', 'Deliver'];

export function Checklist({ service }: { service: string }) {
  const tasks = BY_SERVICE[service] ?? DEFAULT;
  const [done, setDone] = useState<Set<number>>(() => new Set(tasks.map((_, i) => i).slice(0, Math.ceil(tasks.length / 2))));
  const pct = Math.round((done.size / tasks.length) * 100);
  const toggle = (i: number) => setDone((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-muted-foreground">Tasks</span>
        <span className="text-muted-foreground">{done.size}/{tasks.length} · {pct}%</span>
      </div>
      <div className="bar mb-3"><i style={{ width: `${pct}%` }} /></div>
      <ul className="space-y-1.5">
        {tasks.map((t, i) => {
          const checked = done.has(i);
          return (
            <li key={t}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm hover:bg-muted/50">
                <input type="checkbox" checked={checked} onChange={() => toggle(i)} className="h-4 w-4 accent-primary" />
                <span className={checked ? 'text-muted-foreground line-through' : ''}>{t}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
