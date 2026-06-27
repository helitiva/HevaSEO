'use client';

// A lightweight hover/focus card for any staff mention across admin. Wrap a name (or avatar) and
// on hover it floats a compact dossier — score, rank, tier, quality/on-time, this-cycle pay, wallet
// and any pending fines — pulled from the shared admin insight layer. Admin sees money, so pay is
// shown; nothing here leaks to the staff surface. Resolves by staff id OR display name.
//
// Renders through a portal to <body> with fixed positioning so it is never clipped by an
// overflow ancestor (e.g. a scrollable table) and never nests inside a clickable row. An invisible
// padding "bridge" between the trigger and the card keeps it open while the cursor crosses the gap,
// so the action buttons stay clickable instead of the card closing out from under the click.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { STAFF, SKILL_META } from '@/data/adminMock';
import { rosterSignals, resolveStaffId } from '@/data/adminStaffInsight';
import { impersonate } from '@/lib/impersonation';
import { useMoney, useShowMoney, useImpersonatePolicy, useAreaBase } from '@/lib/viewer';

const CARD_W = 288; // matches w-72
const initialsOf = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const hueOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hueOf(name);
  return <span className="grid shrink-0 place-items-center rounded-full font-bold" style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${h} 65% 50% / 0.16)`, color: `hsl(${h} 55% 42%)` }} aria-hidden>{initialsOf(name)}</span>;
}
function MiniBar({ label, pct, warn }: { label: string; pct: number; warn?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]"><span className="text-muted-foreground">{label}</span><span className={`font-semibold ${warn ? 'text-amber-600' : ''}`}>{pct}%</span></div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: warn ? '#f59e0b' : 'hsl(var(--primary))' }} /></div>
    </div>
  );
}

interface Props {
  /** staff id (s1…) or the display name an order stores (e.g. "Mai T."). */
  staff: string;
  children: ReactNode;
  /** wrapper element class — defaults to inline-flex so it sits inside text. */
  className?: string;
}

export function StaffHoverCard({ staff, children, className = '' }: Props) {
  const money = useMoney();
  const showMoney = useShowMoney();
  const imp = useImpersonatePolicy();
  const areaBase = useAreaBase();
  const id = useMemo(() => resolveStaffId(staff), [staff]);
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
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = spaceBelow < 300 && r.top > 300; // open upward when cramped below
    const left = Math.min(Math.max(8, r.left), window.innerWidth - CARD_W - 8);
    const top = flip ? r.top : r.bottom;
    setCoords({ left, top, flip });
  }, []);

  const show = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { place(); setOpen(true); }, 110); };
  const hide = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180); };

  const s = id ? STAFF.find((x) => x.id === id) ?? null : null;
  const sig = useMemo(() => (id ? rosterSignals(id) : null), [id]);

  // Unknown / unassigned staff → render the trigger untouched, no card.
  if (!s || !sig) return <span className={className}>{children}</span>;

  const profileHref = `${areaBase}/staff/${s.id}`;

  const card = open && mounted ? createPortal(
    // Outer = positioned hover region incl. an 8px transparent bridge (pt-2 / pb-2). Inner = the card.
    <div
      id={cardId} role="tooltip"
      onMouseEnter={show} onMouseLeave={hide}
      style={{ position: 'fixed', left: coords.left, top: coords.top, width: CARD_W, transform: coords.flip ? 'translateY(-100%)' : undefined }}
      className={`z-[90] ${coords.flip ? 'pb-2' : 'pt-2'}`}
    >
      <div className="pop-in cursor-default rounded-2xl border border-border bg-card p-3.5 text-left shadow-xl">
        {/* header */}
        <div className="flex items-center gap-2.5">
          <Avatar name={s.name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link href={profileHref} className="truncate text-sm font-semibold hover:text-primary hover:underline">{s.name}</Link>
              {!s.active && <span className="pill pill-warn"><i className="ph-bold ph-pause" aria-hidden />paused</span>}
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{s.role}</p>
          </div>
          <div className="text-right">
            <p className="display text-xl font-bold leading-none text-primary">{s.composite || '—'}</p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">score</p>
          </div>
        </div>

        {/* badges: rank + tier + rating */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {sig.rank && <span className="pill pill-good"><i className="ph-bold ph-trophy" aria-hidden />#{sig.rank} of {sig.teamSize}</span>}
          <span className="pill" style={{ background: 'hsl(var(--primary)/0.1)', color: 'hsl(var(--primary))' }}><i className="ph-bold ph-seal-check" aria-hidden />{sig.tier}</span>
          {sig.avgRating != null && <span className="pill" style={{ background: '#f59e0b1f', color: '#d97706' }}><i className="ph-fill ph-star" aria-hidden />{sig.avgRating.toFixed(1)}</span>}
        </div>

        {/* skills */}
        <div className="mt-2.5 flex flex-wrap gap-1">
          {s.skills.map((k) => SKILL_META[k] && (
            <span key={k} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              <i className={`ph-fill ${SKILL_META[k].icon}`} style={{ color: SKILL_META[k].color }} aria-hidden />{SKILL_META[k].label}
            </span>
          ))}
        </div>

        {/* quality / on-time */}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <MiniBar label="Quality" pct={s.quality} />
          <MiniBar label="On-time" pct={s.onTime} warn={s.onTime < 85} />
        </div>

        {/* pay + conduct row — pay/wallet are money, hidden from money-blind viewers (managers) */}
        <div className={`mt-3 grid gap-2 border-t border-border/60 pt-2.5 text-center ${showMoney ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {showMoney && <div><p className="text-xs font-bold">{money(sig.monthlyPay)}</p><p className="text-[9px] text-muted-foreground">pay / mo</p></div>}
          {showMoney && <div><p className="text-xs font-bold">{money(sig.walletBalance)}</p><p className="text-[9px] text-muted-foreground">wallet</p></div>}
          <div><p className={`text-xs font-bold ${sig.pendingFines > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{sig.pendingFines || '0'}</p><p className="text-[9px] text-muted-foreground">fines pending</p></div>
        </div>

        {/* workload — next 3 days */}
        <div className="mt-3">
          <p className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Next 3 days</span>
            <span className="font-normal normal-case">{sig.activeLoad} in flight{sig.overdue > 0 && <span className="text-rose-600"> · {sig.overdue} overdue</span>}</span>
          </p>
          {sig.upcoming.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{sig.overdue > 0 ? 'Nothing new due — clear overdue first.' : 'Nothing due in the next 3 days.'}</p>
          ) : (
            <div className="space-y-1">
              {sig.upcoming.map((t) => (
                <div key={t.code} className="flex items-center gap-1.5 text-[11px]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.priority === 'high' ? 'bg-rose-500' : t.priority === 'med' ? 'bg-amber-500' : 'bg-muted-foreground/50'}`} />
                  <span className="font-medium">{t.code}</span>
                  <span className="truncate text-muted-foreground">{t.service}</span>
                  <span className={`ml-auto shrink-0 font-semibold ${t.days === 0 ? 'text-amber-600' : t.days <= 1 ? 'text-amber-600' : 'text-muted-foreground'}`}>{t.days === 0 ? 'today' : `${t.days}d`}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* actions */}
        <div className="mt-3 flex items-center gap-1.5">
          <a href={profileHref} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-center text-xs font-semibold text-primary-foreground transition hover:bg-primary/90">
            <i className="ph-bold ph-arrow-square-out" aria-hidden />Open profile
          </a>
          {imp.canStaff && (
            <button onClick={() => impersonate(s.id, imp.viewOnly ? 'view' : 'act')} title={imp.viewOnly ? `View ${s.name}’s portal (read-only)` : `Open the staff portal as ${s.name}`} className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:border-primary/50 hover:text-primary">
              <i className="ph-bold ph-user-switch" aria-hidden />{imp.viewOnly ? 'View as' : 'Impersonate'}
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
