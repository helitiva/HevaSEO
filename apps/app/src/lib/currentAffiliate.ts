// Server-side resolution of "which partner the /affiliate portal renders for".
// Default = the demo partner; when an admin impersonates, the heva_as_affiliate cookie
// names another partner. Validated against the roster so a stale cookie falls back.
import { cookies } from 'next/headers';
import { IMPERSONATE_AFFILIATE_COOKIE } from '@/lib/impersonation';
import { adminAffiliates } from '@/data/adminAffiliate';
import { DEFAULT_AFFILIATE_ID } from '@/data/affiliatePortal';

export async function currentAffiliateId(): Promise<string> {
  const store = await cookies();
  const id = store.get(IMPERSONATE_AFFILIATE_COOKIE)?.value;
  if (id && id !== DEFAULT_AFFILIATE_ID && adminAffiliates().some((a) => a.id === id)) return id;
  return DEFAULT_AFFILIATE_ID;
}

export async function isImpersonatingAffiliate(): Promise<boolean> {
  return (await currentAffiliateId()) !== DEFAULT_AFFILIATE_ID;
}
