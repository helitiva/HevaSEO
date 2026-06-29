import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * Server-side Supabase client (RSC, route handlers, server actions). Reads the session from cookies
 * and sends the user's JWT, so every query is RLS-scoped to that user (the Auth hook injected
 * tenant_id/app_role/profile_id — E0a+). Never use the service_role here.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components cannot set cookies; middleware/route handlers refresh the session.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* called from a Server Component — safe to ignore */
          }
        },
      },
    },
  );
}
