import { PageHeader } from '@/components/shared/PageHeader';
import { getQuotes } from '@/data/quotes.server';
import { QuotesClient } from './QuotesClient';

export const metadata = { title: 'Quotes' };

/**
 * The quote queue — custom jobs waiting on a price.
 *
 * TENANT-WIDE, not pod-scoped, and that's deliberate: a pod is derived from which staff work a
 * customer's orders, and a customer asking for a custom job usually has none yet. Pod-scoping this
 * would make every new lead belong to nobody and be seen by no one. Quoting is sales; pod-scoping
 * resumes the moment an accepted quote becomes an order.
 */
export default async function ManagerQuotesPage() {
  const quotes = await getQuotes(); // RLS: managers see the shared queue
  return (
    <section className="space-y-4">
      <PageHeader title="Quotes" subtitle="Custom jobs waiting on a price — quote it, send the link, get paid" />
      <QuotesClient quotes={quotes} />
    </section>
  );
}
