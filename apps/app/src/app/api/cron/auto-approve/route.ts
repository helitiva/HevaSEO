import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// Scheduled job endpoint — approves delivered orders whose grace window has elapsed (the customer never
// responded). Wire a daily scheduler to hit this: Vercel Cron, Supabase scheduled function, or any cron
// with `Authorization: Bearer $CRON_SECRET`. Auth is enforced only when CRON_SECRET is set (so local
// dev can invoke it freely); ALWAYS set CRON_SECRET in production.
export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured (local/dev) → allow
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('auto_approve_stale_deliveries', {});
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, approved: data ?? 0 });
}

// GET for Vercel Cron (which issues GET); POST for manual/other schedulers.
export const GET = run;
export const POST = run;
