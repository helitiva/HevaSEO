import { AffiliateShell } from '@/components/affiliate/AffiliateShell';

// Wraps only the logged-in affiliate surface. The public /affiliate/join page lives
// OUTSIDE this route group, so it renders without the dashboard shell.
export default function AffiliateDashLayout({ children }: { children: React.ReactNode }) {
  return <AffiliateShell>{children}</AffiliateShell>;
}
