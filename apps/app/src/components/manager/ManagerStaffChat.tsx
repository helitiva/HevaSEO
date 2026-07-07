'use client';

import { useState } from 'react';
import { MessageAttachments } from '@/components/MessageAttachments';
import { postManagerChatAction } from '@/app/staff/tasks/[id]/managerChat.actions';
import type { StaffMessage } from '@/data/staffMock';

// The manager's side of the real manager↔staff thread (staff_manager_messages). Posts via
// postManagerChatAction(body, staffId); the staffer sees it on their task detail's "Chat with …" panel.
export function ManagerStaffChat({ staffId, staffName, initial }: { staffId: string; staffName: string; initial: StaffMessage[] }) {
  const [msgs, setMsgs] = useState<StaffMessage[]>(initial);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const first = staffName.split(' ')[0];

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft(''); setErr('');
    setMsgs((x) => [...x, { who: 'You', body, internal: true, at: 'now' }]); // optimistic
    setSending(true);
    const r = await postManagerChatAction(body, staffId);
    setSending(false);
    if (!r.ok) { setMsgs((x) => x.filter((m) => !(m.who === 'You' && m.body === body && m.at === 'now'))); setErr(r.error); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chats-circle text-primary" aria-hidden />Message {first}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Private thread with your pod staffer — they see it on their task detail.</p>
      <div className="my-3 max-h-52 space-y-2 overflow-y-auto">
        {msgs.length === 0 ? <p className="text-xs text-muted-foreground">No messages yet — send the first one.</p> : msgs.map((x, i) => (
          <div key={i} className={`flex ${x.who === 'You' ? 'justify-end' : ''}`}>
            <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs ${x.who === 'You' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {x.who !== 'You' && <span className="mr-1 font-semibold">{x.who}:</span>}{x.body} <span className="opacity-60">· {x.at}</span>
              <MessageAttachments items={x.attachments} />
            </div>
          </div>
        ))}
      </div>
      {err && <p role="alert" className="mb-2 text-xs font-medium text-destructive">{err}</p>}
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={`Message ${first}…`} aria-label={`Message ${first}`} className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary" />
        <button onClick={send} disabled={sending} aria-label="Send message" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"><i className="ph-bold ph-paper-plane-tilt" aria-hidden /></button>
      </div>
    </div>
  );
}
