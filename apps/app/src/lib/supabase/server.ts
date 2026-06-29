import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import type { Session, AuthRole } from '@/lib/auth';

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

/**
 * The signed-in user for Server Components, shaped like the client `Session`. Identity is verified
 * via getUser(); the portal role comes from the user's own profile row (RLS-scoped — a user can read
 * their own tenant's profiles). Returns null if signed out or not yet provisioned. inc-3 uses this to
 * RLS-scope the read layer.
 */
export async function getServerSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return null;

  const name = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : (profile.name ?? user.email ?? '');
  return { accountId: user.id, role: profile.role as AuthRole, name, email: user.email ?? '', entityId: profile.id };
}
