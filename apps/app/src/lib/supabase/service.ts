import 'server-only';
import { createClient as createSupabase } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Service-role client — bypasses RLS. ONLY for trusted server-side money-in that the hardened DB
// functions restrict to service_role (create_order / topup are revoked from authenticated). Never
// import this from a client component or a route the user controls; use it inside server actions /
// webhooks / workers only (ADR §service_role). Reads the key from a server-only env var (NOT
// NEXT_PUBLIC) so it never reaches the browser bundle.
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (server-only).');
  return createSupabase<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
