'use client';

// A lightweight hover/focus card for any customer mention across admin. Wrap a name or company and
// on hover it floats a compact dossier — tier, status, spend/balance, orders, open tickets and
// recent activity — from the customer insight layer. Resolves by customer id, company, or contact
// name. Portals to <body> with a transparent hover "bridge" so the action buttons stay clickable.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { TIER, SERVICE_SKILL, SKILL_META } from '@/data/adminMock';
import { useMoney, useShowMoney, useImpersonatePolicy, useAreaBase } from '@/lib/viewer';
import { customerSignals, resolveCustomerId } from '@/data/adminCustomerInsight';
import { impersonateCustomer } from '@/lib/impersonation';

const CARD_W = 420; // ~40% wider to fit service mix + staff-care
const initialsOf = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const hueOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const svcMeta = (service: string) => SKILL_META[SERVICE_SKILL[service] ?? ''] ?? { label: service, icon: 'ph-circle', color: '#64748b' };

interface Props {
  /** customer id (c1…), company ("Acme Co"), or contact name. */
  customer: string;
  children: ReactNode;
  className?: string;
}

export function CustomerHoverCard({ customer, children, className = '' }: Props) {
  const money = useMoney();
  const showMoney = useShowMoney();
  const imp = useImpersonatePolicy();
  const areaBase = useAreaBase();
  const id = useMemo(() => resolveCustomerId(customer), [customer]);
  const sig = useMemo(() => (id ? customerSignals(id) : null), [id]);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; flip: boolean }>({ left: 0, top: 0, flip: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const flip = window.innerHeight - r.bottom < 260 && r.top > 260;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - CARD_W - 8);
    setCoords({ left, top: flip ? r.top : r.bottom, flip });
  }, []);

  const show = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { place(); setOpen(true); }, 110); };
  const hide = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180); };

  if (!id || !sig) return <span className={className}>{children}</span>;
  const tier = TIER[sig.tier];
  const profileHref = `${areaBase}/customers/${sig.id}`;

  const card = open && mounted ? createPortal(
    <div
      id={cardId} role="tooltip" onMouseEnter={show} onMouseLeave={hide}
      style={{ position: 'fixed', left: coords.left, top: coords.top, width: CARD_W, transform: coords.flip ? 'translateY(-100%)' : undefined }}
      className={`z-[90] ${coords.flip ? 'pb-2' : 'pt-2'}`}
    >
      <div className="pop-in max-h-[88vh] cursor-default overflow-y-auto rounded-2xl border border-border bg-card p-3 text-left shadow-xl">
        {/* header */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold" style={{ background: `${tier.color}1f`, color: tier.color }} aria-hidden>{initialsOf(sig.company)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link href={profileHref} className="truncate text-sm font-semibold hover:text-primary hover:underline">{sig.company}</Link>
              <span className={`pill ${sig.status === 'claimed' ? 'pill-good' : 'pill-warn'}`}>{sig.status}</span>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{sig.name} · {sig.email}</p>
          </div>
          <span className="pill shrink-0" style={{ background: `${tier.color}1f`, color: tier.color }}><i className={`ph-fill ${tier.icon}`} aria-hidden />{sig.tierLabel}</span>
        </div>

        {/* compact stats strip */}
        <div className="mt-2.5 flex items-stretch divide-x divide-border/60 rounded-lg border border-border/60 text-center">
          {showMoney && <div className="flex-1 py-1.5"><p className="text-xs font-bold">{money(sig.spend)}</p><p className="text-[9px] text-muted-foreground">lifetime</p></div>}
          {showMoney && <div className="flex-1 py-1.5"><p className={`text-xs font-bold ${sig.balance > 0 ? 'text-emerald-600' : ''}`}>{money(sig.balance)}</p><p className="text-[9px] text-muted-foreground">wallet</p></div>}
          <div className="flex-1 py-1.5"><p className="text-xs font-bold">{sig.orders}<span className="text-muted-foreground"> · {sig.activeOrders}</span></p><p className="text-[9px] text-muted-foreground">orders·live</p></div>
          <div className="flex-1 py-1.5"><p className={`text-xs font-bold ${sig.openTickets > 0 ? 'text-rose-600' : ''}`}>{sig.openTickets}</p><p className="text-[9px] text-muted-foreground">tickets</p></div>
        </div>

        {/* two columns: service mix · who handles */}
        <div className="mt-2.5 grid grid-cols-2 gap-3">
          {/* service mix — top services, % by volume / value */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Service mix <span className="font-normal lowercase">(vol/val)</span></p>
            <div className="space-y-1">
              {sig.serviceMix.slice(0, 4).map((m) => { const meta = svcMeta(m.service);
                return (
                  <div key={m.service} title={`${m.count} orders · ${money(m.value)} · ${m.pctCount}% of orders · ${m.pctValue}% of value`}>
                    <div className="flex items-center gap-1 text-[11px]">
                      <i className={`ph-fill ${meta.icon} shrink-0`} style={{ color: meta.color }} aria-hidden />
                      <span className="truncate font-medium">{m.service}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{m.pctCount}/{m.pctValue}%</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${m.pctValue}%`, background: meta.color }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* who handles their work */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Handled by</p>
            {sig.staffCare.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Unassigned</p>
            ) : (
              <div className="space-y-1">
                {sig.staffCare.slice(0, 4).map((st) => { const h = hueOf(st.staff);
                  return (
                    <div key={st.staff} className="flex items-center gap-1.5 text-[11px]" title={st.services.map((s) => `${s.service} ${s.count}`).join(' · ')}>
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[7px] font-bold" style={{ background: `hsl(${h} 65% 50% / 0.16)`, color: `hsl(${h} 55% 42%)` }} aria-hidden>{initialsOf(st.staff)}</span>
                      <span className="truncate font-medium">{st.staff}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-0.5">
                        <span className="text-[10px] text-muted-foreground">{st.count}</span>
                        {st.services.slice(0, 3).map((sv) => { const m = svcMeta(sv.service);
                          return <i key={sv.service} className={`ph-fill ${m.icon} text-[10px]`} style={{ color: m.color }} aria-hidden />;
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* recent orders — 4 latest, two columns */}
        {sig.recent.length > 0 && (
          <div className="mt-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent orders</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {sig.recent.map((o) => { const meta = svcMeta(o.service);
                return (
                  <div key={o.id} className="flex items-center gap-1 text-[10px]" title={`${o.service} · ${o.created}`}>
                    <i className={`ph-fill ${meta.icon} shrink-0`} style={{ color: meta.color }} aria-hidden />
                    <span className="font-semibold">{o.code}</span>
                    <span className="truncate text-muted-foreground">{o.service}</span>
                    <span className="ml-auto shrink-0 font-medium">{money(o.value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* actions */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <a href={profileHref} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-center text-xs font-semibold text-primary-foreground transition hover:bg-primary/90">
            <i className="ph-bold ph-arrow-square-out" aria-hidden />Open profile
          </a>
          {imp.canCustomer && (
            <button onClick={() => impersonateCustomer(sig.id)} title={`Open the customer portal as ${sig.company}`} className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:border-primary/50 hover:text-primary">
              <i className="ph-bold ph-user-switch" aria-hidden />Impersonate
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <span ref={triggerRef} className={`inline-flex ${className}`} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} aria-describedby={open ? cardId : undefined}>
      {children}
      {card}
    </span>
  );
}
