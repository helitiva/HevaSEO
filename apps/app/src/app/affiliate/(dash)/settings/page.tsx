import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsClient } from './SettingsClient';
import { portalDataFor } from '@/data/affiliatePortal';
import { getAffiliatePortalData, getMyAffiliatePayoutMethods } from '@/data/affiliate.server';
import { currentAffiliateId } from '@/lib/currentAffiliate';

export const metadata: Metadata = { title: 'Affiliate settings' };

export default async function AffiliateSettingsPage() {
  // Lane E inc-E12/E14/E15 — real profile + code + payout methods, with mock fallback. `editable` gates
  // the real writes on a genuine affiliate session (impersonation/demo personas stay read-only).
  const real = await getAffiliatePortalData();
  const { affiliate } = real ?? portalDataFor(await currentAffiliateId());
  const methods = real ? await getMyAffiliatePayoutMethods() : [];
  return (
    <section>
      <PageHeader title="Settings" subtitle="Your profile, affiliate code, and payout methods." />
      <SettingsClient me={affiliate} editable={Boolean(real)} methods={methods} />
    </section>
  );
}
