import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsClient } from './SettingsClient';
import { portalDataFor } from '@/data/affiliatePortal';
import { getAffiliatePortalData } from '@/data/affiliate.server';
import { currentAffiliateId } from '@/lib/currentAffiliate';

export const metadata: Metadata = { title: 'Affiliate settings' };

export default async function AffiliateSettingsPage() {
  // Lane E inc-E12 — real profile (marketing metadata now tabled) with mock fallback. `editable` gates
  // the real Save on a genuine affiliate session (impersonation/demo personas stay read-only).
  const real = await getAffiliatePortalData();
  const { affiliate } = real ?? portalDataFor(await currentAffiliateId());
  return (
    <section>
      <PageHeader title="Settings" subtitle="Your profile, affiliate code, and payout method." />
      <SettingsClient me={affiliate} editable={Boolean(real)} />
    </section>
  );
}
