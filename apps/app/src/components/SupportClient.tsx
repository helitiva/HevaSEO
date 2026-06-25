'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { TicketForm } from './TicketForm';
import { SpecialistChat } from './SpecialistChat';
import { useToast } from './Toast';

type Ticket = { code: string; subject: string; type: string; status: string; pill: string; updated: string; open: boolean };

const SEED_TICKETS: Ticket[] = [
  { code: '#HV-1042', subject: 'Links not indexed after 5 days', type: 'Technical', status: 'In progress', pill: 'pill-good', updated: '2 hours ago', open: true },
  { code: '#HV-1039', subject: 'May VAT invoice', type: 'Billing', status: 'Awaiting reply', pill: 'pill-warn', updated: 'Yesterday', open: true },
  { code: '#HV-1031', subject: 'Advice on an entity + content combo', type: 'Consultation', status: 'Closed', pill: 'closed', updated: '3 days ago', open: false },
];

const CONNECT = [
  { k: 'WhatsApp', icon: 'ph-whatsapp-logo', color: '#25D366' },
  { k: 'Messenger', icon: 'ph-messenger-logo', color: '#0084FF' },
];

function StatusPill({ t }: { t: Ticket }) {
  if (t.pill === 'closed') return <span className="pill" style={{ background: '#10b9811f', color: '#059669' }}>● {t.status}</span>;
  return <span className={`pill ${t.pill}`}>● {t.status}</span>;
}

function ticketThread(t: Ticket) {
  return [
    { mine: true, name: 'You', text: `${t.subject}. Could you take a look?`, time: 'Earlier' },
    { mine: false, name: 'Olivia Chen', text: t.open ? "Thanks for the details — I'm on it and will update you shortly. 🙌" : 'Glad we could sort this out. Closing the ticket — reach out anytime!', time: t.updated },
  ];
}

export function SupportClient() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>(SEED_TICKETS);
  const [connectOpen, setConnectOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const openCount = tickets.filter((t) => t.open).length;

  const addTicket = (subject: string, type: string) => {
    const code = `#HV-${Date.now().toString().slice(-4)}`;
    setTickets((prev) => [{ code, subject, type, status: 'Awaiting reply', pill: 'pill-warn', updated: 'Just now', open: true }, ...prev]);
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">Submit a ticket or chat live with an advisor. Replies within business hours &lt; 2 hours.</p>
        </div>
        <span className="pill pill-live self-start sm:self-auto"><span /> Advisors online now</span>
      </div>

      {/* quick channels */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SpecialistChat className="channel flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><i className="ph-bold ph-chats-circle text-xl" /></span>
          <span className="block"><span className="block font-semibold">Live chat</span><span className="block text-xs text-muted-foreground">Fastest response · real time</span></span>
          <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-primary">Open chat <i className="ph-bold ph-arrow-right" /></span>
        </SpecialistChat>
        <a href="tel:+14155550142" className="channel flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600"><i className="ph-bold ph-phone-call text-xl" /></span>
          <div><p className="font-semibold">Hotline</p><p className="text-xs text-muted-foreground">+1 (415) 555-0142</p></div>
          <span className="mt-auto text-xs font-medium text-muted-foreground">8:00 AM–9:00 PM daily</span>
        </a>
        <a href="mailto:hello@hevaseo.com" className="channel flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/15 text-amber-600"><i className="ph-bold ph-envelope-simple text-xl" /></span>
          <div><p className="font-semibold">Email</p><p className="text-xs text-muted-foreground">hello@hevaseo.com</p></div>
          <span className="mt-auto text-xs font-medium text-muted-foreground">Reply &lt; 24 hours</span>
        </a>
        <button onClick={() => setConnectOpen(true)} className="channel flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/15 text-sky-600"><i className="ph-bold ph-chat-teardrop-dots text-xl" /></span>
          <div><p className="font-semibold">WhatsApp / Messenger</p><p className="text-xs text-muted-foreground">Connect account</p></div>
          <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-primary">Connect <i className="ph-bold ph-arrow-right" /></span>
        </button>
      </section>

      {/* form + advisor */}
      <section className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <TicketForm onSubmit={addTicket} />
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-headset text-primary" /> Your advisor</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="relative">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">OC</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
              <div className="text-sm"><p className="font-semibold leading-tight">Olivia Chen</p><p className="text-[11px] text-muted-foreground">SEO Lead · online</p></div>
            </div>
            <SpecialistChat className="mt-4 w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">
              <span className="inline-flex items-center justify-center gap-1.5"><i className="ph-bold ph-chat-circle-dots" /> Message now</span>
            </SpecialistChat>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Response commitment (SLA)</p>
            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Live chat</span><span className="pill pill-good">&lt; 5 minutes</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Urgent ticket</span><span className="pill pill-good">&lt; 2 hours</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Standard ticket</span><span className="pill pill-warn">&lt; 24 hours</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Business hours</span><span className="font-medium">8:00–21:00</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Frequently Asked Questions</p>
            <div className="mt-3 space-y-1">
              {['How long until a link gets indexed?', 'How to top up & use credits', 'Refund / cancellation policy'].map((q) => (
                <a key={q} href="http://localhost:4330/#faq" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"><span>{q}</span><i className="ph-bold ph-arrow-up-right" /></a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* tickets table */}
      <section className="mt-5">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="display text-lg font-semibold tracking-tight">Your tickets</h3>
              <p className="text-xs text-muted-foreground">Click a ticket to view the conversation</p>
            </div>
            <span className="pill pill-good">{openCount} open</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pr-3">Code</th>
                  <th className="px-3 py-2.5">Subject</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="py-2.5 pl-3 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((t) => (
                  <tr key={t.code} onClick={() => { setReply(''); setActiveTicket(t); }} className="cursor-pointer transition hover:bg-accent/40">
                    <td className={`py-3 pr-3 font-semibold ${t.open ? 'text-primary' : 'text-muted-foreground'}`}>{t.code}</td>
                    <td className="px-3 py-3">{t.subject}</td>
                    <td className="px-3 py-3 text-muted-foreground">{t.type}</td>
                    <td className="px-3 py-3"><StatusPill t={t} /></td>
                    <td className="py-3 pl-3 text-right text-muted-foreground">{t.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">HevaSEO Workspace · Support · sample data</p>

      {/* connect channel modal */}
      {connectOpen && (
        <Modal onClose={() => setConnectOpen(false)} title="Connect a channel" subtitle="Get replies where you already chat" icon="ph-chat-teardrop-dots">
          {({ close }) => (
            <div className="space-y-2">
              {CONNECT.map((c) => (
                <button key={c.k} type="button" onClick={() => { toast(`${c.k} connected — we'll reply there too`); close(); }} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary/50 hover:bg-accent">
                  <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: `${c.color}1f`, color: c.color }}><i className={`ph-bold ${c.icon} text-xl`} /></span>
                  <span className="flex-1"><span className="block text-sm font-semibold">{c.k}</span><span className="block text-[11px] text-muted-foreground">Link your {c.k} to message us there</span></span>
                  <i className="ph-bold ph-arrow-right text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ticket detail modal */}
      {activeTicket && (
        <Modal onClose={() => setActiveTicket(null)} title={activeTicket.subject} subtitle={`${activeTicket.code} · ${activeTicket.type}`} icon="ph-ticket">
          {({ close }) => (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs"><StatusPill t={activeTicket} /><span className="text-muted-foreground">Updated {activeTicket.updated}</span></div>
              <div className="space-y-3">
                {ticketThread(activeTicket).map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                    <span className="px-1 text-[10px] font-medium text-muted-foreground">{m.name} · {m.time}</span>
                    <div className={`mt-0.5 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.mine ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-muted text-foreground'}`}>{m.text}</div>
                  </div>
                ))}
              </div>
              {activeTicket.open ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); if (!reply.trim()) return; toast('Reply sent'); setReply(''); close(); }}
                  className="flex items-end gap-2 border-t border-border pt-3"
                >
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Write a reply…" className="scrollbar-thin max-h-28 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <button type="submit" disabled={!reply.trim()} aria-label="Send reply" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"><i className="ph-bold ph-paper-plane-tilt" /></button>
                </form>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">This ticket is closed. Submit a new one if you still need help.</p>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
