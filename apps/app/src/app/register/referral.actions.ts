'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// The second half of the affiliate funnel. /r/<code> drops a 30-day `heva_ref` cookie and redirects to
// marketing; when that visitor comes back and signs up, this claims them for the partner.
//
// Server-side on purpose: the cookie is read here and only the CODE crosses into the database. The RPC
// derives the customer from the caller's JWT claims, so a client can never attribute a different account.
// not exported: a "use server" module may only export async functions
const REF_COOKIE = 'heva_ref';

/** Claim the just-signed-up customer for the affiliate whose link they arrived through.
 *  Best-effort: attribution must never fail a signup, so every failure path is swallowed and the caller
 *  proceeds. Returns true only when a referral row was actually created. */
export async function claimReferralAction(): Promise<boolean> {
  try {
    const jar = await cookies();
    const code = jar.get(REF_COOKIE)?.value?.trim();
    if (!code) return false;

    const supabase = await createClient();
    // null = nothing attributed (unknown/inactive code, already referred, self-referral, existing customer)
    const { data, error } = await supabase.rpc('attribute_referral', { p_code: code });
    if (error) return false;

    // The link has done its job — drop the cookie so a later signup on this browser (a colleague, a second
    // account) is not silently credited to the same partner.
    if (data) jar.delete(REF_COOKIE);
    return Boolean(data);
  } catch {
    return false;   // never block signup
  }
}
