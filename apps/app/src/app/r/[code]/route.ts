import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { REF_ORIGIN } from '@/lib/affiliate';

// Lane E inc-E16 — the affiliate share link. Records the click (record_affiliate_click, anon-callable +
// SECURITY DEFINER) then 302s to the marketing site with ?ref + a 30-day attribution cookie. A tracking
// failure never blocks the redirect. No auth — a click has no session.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

  try {
    const supabase = await createClient();
    await supabase.rpc('record_affiliate_click', { p_code: clean });
  } catch {
    /* tracking is best-effort — always redirect */
  }

  const dest = new URL('/', REF_ORIGIN);
  if (clean) dest.searchParams.set('ref', clean);
  const res = NextResponse.redirect(dest.toString());
  if (clean) res.cookies.set('heva_ref', clean, { maxAge: 60 * 60 * 24 * 30, path: '/', sameSite: 'lax' });
  return res;
}
