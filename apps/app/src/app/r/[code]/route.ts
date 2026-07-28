import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { REF_ORIGIN } from '@/lib/affiliate';

// Lane E inc-E16/E17 — the affiliate share link. Records the click (record_affiliate_click, anon-callable
// + SECURITY DEFINER) then 302s to the marketing site with ?ref + a 30-day attribution cookie. A tracking
// failure never blocks the redirect. No auth — a click has no session.
//
// Dedup (E17): a per-code `hvc_<code>` cookie suppresses repeat counts from the same browser within the
// window, so a refresh / re-open doesn't inflate clicks.
// Rate-limit (E21): a per-(IP, code) cap defends against cookie-clearing abuse — at most MAX_PER_IP
// counted clicks per window from one IP for a given code. Backed by the durable Postgres rate_hit()
// (multi-instance safe). Attribution + redirect always happen; only the COUNT is gated, and a limiter
// error fails OPEN (best-effort counting must never block the redirect).
const DEDUP_WINDOW_S = 60 * 60 * 6; // 6h
const REF_COOKIE_S = 60 * 60 * 24 * 30; // 30d
const RL_WINDOW_S = 60 * 60; // 1h
const RL_MAX_PER_IP = 10;

async function ipAllows(ip: string, code: string): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { data: allowed, error } = await svc.rpc('rate_hit', { p_key: `refclick:${ip}:${code}`, p_max: RL_MAX_PER_IP, p_window_secs: RL_WINDOW_S });
    if (error) return true; // fail-open
    return allowed !== false;
  } catch {
    return true; // fail-open
  }
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  return (xff ? xff.split(',')[0]?.trim() : '') || req.headers.get('x-real-ip') || 'unknown';
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

  const jar = await cookies();
  const alreadyCounted = clean ? jar.has(`hvc_${clean}`) : true;
  // count only when the cookie hasn't seen it AND the IP is under its per-code cap
  const shouldCount = Boolean(clean) && !alreadyCounted && (await ipAllows(clientIp(req), clean));

  if (shouldCount) {
    try {
      const supabase = await createClient();
      await supabase.rpc('record_affiliate_click', { p_code: clean });
    } catch {
      /* tracking is best-effort — always redirect */
    }
  }

  const dest = new URL('/', REF_ORIGIN);
  if (clean) dest.searchParams.set('ref', clean);
  const res = NextResponse.redirect(dest.toString());
  if (clean) {
    res.cookies.set('heva_ref', clean, { maxAge: REF_COOKIE_S, path: '/', sameSite: 'lax' });
    res.cookies.set(`hvc_${clean}`, '1', { maxAge: DEDUP_WINDOW_S, path: '/', sameSite: 'lax' });
  }
  return res;
}
