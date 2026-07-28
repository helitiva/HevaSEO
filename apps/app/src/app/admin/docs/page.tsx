import { AdminDocsManager } from '@/components/docs/AdminDocsManager';
import { getDocs } from '@/data/docs.server';

export const metadata = { title: 'Docs' };

// Lane C inc-C3 — admin sees ALL tenant docs (docs_admin RLS) and manages them via real CRUD.
export default async function AdminDocsPage() {
  const docs = await getDocs();
  return <AdminDocsManager docs={docs} />;
}
