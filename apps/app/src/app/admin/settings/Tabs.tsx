'use client';
import { useState } from 'react';
const TABS = ['General', 'SLA', 'Routing & scoring', 'Email', 'Integrations', 'Admins'];
export function SettingsTabs() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-semibold transition ${tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t}</button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">{tab}</p>
        <p className="mt-1">Configuration for {tab.toLowerCase()} (mock). Wired to the settings store in the backend phase.</p>
      </div>
    </div>
  );
}
