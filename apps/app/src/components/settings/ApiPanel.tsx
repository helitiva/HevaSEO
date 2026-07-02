'use client';

import { useState } from 'react';
import { useToast } from '../Toast';
import { Modal } from '../Modal';
import {
  createApiKeyAction, revokeApiKeyAction, saveWebhookAction, deleteWebhookAction, sendWebhookTestAction,
  type ApiKey, type Webhook,
} from '@/app/(portal)/settings.actions';

const WEBHOOK_EVENTS = ['order.created', 'order.completed', 'index.done', 'credit.low'];
const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; } };

export function ApiPanel({ initialApiKeys, initialWebhook }: { initialApiKeys: ApiKey[]; initialWebhook: Webhook }) {
  const toast = useToast();
  const [keys, setKeys] = useState<ApiKey[]>(initialApiKeys.filter((k) => !k.revokedAt));
  const [nameOpen, setNameOpen] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  const [webhook, setWebhook] = useState<Webhook>(initialWebhook);
  const [url, setUrl] = useState(initialWebhook?.url ?? '');
  const [events, setEvents] = useState<string[]>(initialWebhook?.events ?? ['order.created', 'order.completed', 'index.done']);

  const generate = async (label: string, close: () => void) => {
    const r = await createApiKeyAction(label || 'Default');
    if (!r.ok) { toast(r.error ?? 'Generate failed', 'error'); return; }
    setKeys((k) => [r.key, ...k]);
    setNewToken(r.token);
    close();
    toast('API key created — copy it now, it won’t be shown again');
  };
  const revoke = async (id: string) => {
    const r = await revokeApiKeyAction(id);
    if (!r.ok) { toast(r.error ?? 'Revoke failed', 'error'); return; }
    setKeys((k) => k.filter((x) => x.id !== id));
    toast('API key revoked');
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Copied'); }
    catch { toast('Copy failed — select and copy manually', 'error'); }
  };
  const toggleEvent = (e: string) => setEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  const saveWebhook = async () => {
    const r = await saveWebhookAction(url, events);
    if (!r.ok) { toast(r.error ?? 'Save failed', 'error'); return; }
    setWebhook(r.webhook); toast('Webhook saved');
  };
  const removeWebhook = async () => {
    if (!webhook) return;
    const r = await deleteWebhookAction(webhook.id);
    if (!r.ok) { toast(r.error ?? 'Delete failed', 'error'); return; }
    setWebhook(null); setUrl(''); toast('Webhook removed');
  };
  const sendTest = async () => {
    const r = await sendWebhookTestAction(url);
    toast(r.ok ? 'Test event delivered ✓' : r.error ?? 'Delivery failed', r.ok ? 'success' : 'error');
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="display text-lg font-semibold tracking-tight">API keys</h2><p className="text-xs text-muted-foreground">Use these to integrate HevaSEO into your systems.</p></div>
          <button onClick={() => setNameOpen(true)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-plus" aria-hidden /> New key</button>
        </div>
        <div className="mt-4 space-y-2">
          {keys.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">No API keys yet.</p>}
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <i className="ph-bold ph-key text-lg text-primary" aria-hidden />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{k.label}</p><p className="font-mono text-[11px] text-muted-foreground">sk_live_••••••••{k.last4} · created {fmtDate(k.createdAt)}</p></div>
              <button onClick={() => revoke(k.id)} className="text-[11px] font-semibold text-destructive hover:underline">Revoke</button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="display text-base font-semibold tracking-tight">Webhook</h2><p className="text-xs text-muted-foreground">Receive real-time events sent to your URL.</p></div>
          {webhook && <button onClick={removeWebhook} className="text-[11px] font-semibold text-destructive hover:underline">Remove</button>}
        </div>
        <div className="mt-4"><label className="lbl">Endpoint URL</label><input type="url" className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourapp.com/webhooks/hevaseo" /></div>
        <p className="mt-4 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Outbound events</p>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          {WEBHOOK_EVENTS.map((e) => (
            <label key={e} className="flex items-center gap-2"><input type="checkbox" checked={events.includes(e)} onChange={() => toggleEvent(e)} className="accent-[hsl(var(--primary))]" /> {e}</label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={sendTest} className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Send test</button>
          <button type="button" onClick={saveWebhook} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Save webhook</button>
        </div>
      </div>

      {nameOpen && (
        <Modal onClose={() => setNameOpen(false)} title="New API key" subtitle="Give it a name so you can tell keys apart" icon="ph-key">
          {({ close }) => <NameKeyForm onCreate={(label) => generate(label, close)} />}
        </Modal>
      )}

      {newToken && (
        <Modal onClose={() => setNewToken(null)} title="Copy your API key" subtitle="This is the only time the full key is shown" icon="ph-key">
          {() => (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{newToken}</code>
                <button onClick={() => copy(newToken)} className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold transition hover:bg-accent"><i className="ph-bold ph-copy" aria-hidden /> Copy</button>
              </div>
              <p className="text-[11px] text-muted-foreground">Store it securely — we only keep a hash and can’t show it again.</p>
              <div className="flex justify-end"><button onClick={() => setNewToken(null)} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">Done</button></div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

function NameKeyForm({ onCreate }: { onCreate: (label: string) => void }) {
  const [label, setLabel] = useState('');
  return (
    <div className="space-y-3">
      <div><label className="lbl">Key name</label><input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Production server" /></div>
      <div className="flex justify-end"><button onClick={() => onCreate(label.trim())} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Generate key</button></div>
    </div>
  );
}
