import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsClient } from './SettingsClient';
import { portalDataFor } from '@/data/affiliatePortal';
import { currentAffiliateId } from '@/lib/currentAffiliate';

export const metadata: Metadata = { title: 'Affiliate settings' };

export default async function AffiliateSettingsPage() {
  const { affiliate } = portalDataFor(await currentAffiliateId());
  return (
    <section>
      <PageHeader title="Settings" subtitle="Your profile, affiliate code, and payout method." />
      <SettingsClient me={affiliate} />
    </section>
  );
}
