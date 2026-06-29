'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/** Browser Supabase client (client components). RLS-scoped to the signed-in user via cookies. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
