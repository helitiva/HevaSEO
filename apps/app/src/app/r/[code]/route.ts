import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { REF_ORIGIN } from '@/lib/affiliate';

// Lane E inc-E16/E17 — the affiliate share link. Records the click (record_affiliate_click, anon-callable
// + SECURITY DEFINER) then 302s to the marketing site with ?ref + a 30-day attribution cookie. A tracking
// failure never blocks the redirect. No auth — a click has no session.
//
// Dedup (E17): a per-code `hvc_<code>` cookie suppresses repeat counts from the same browser within the
// window, so a refresh / re-open doesn't inflate clicks. Best-effort (cookie-based); IP/rate-limit is a
// further hardening step. Attribution + redirect still happen on a deduped hit.
const DEDUP_WINDOW_S = 60 * 60 * 6; // 6h
const REF_COOKIE_S = 60 * 60 * 24 * 30; // 30d

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

  const jar = await cookies();
  const alreadyCounted = clean ? jar.has(`hvc_${clean}`) : true;

  if (clean && !alreadyCounted) {
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
