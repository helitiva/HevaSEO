'use client';
import Link from 'next/link';
import { useDocs } from '@/data/docsStore';
import { docForCustomer, docForManager, docForStaff } from '@/data/staffDocs';
import { DocArticle } from '@/app/staff/docs/DocArticle';

type Audience = 'customer' | 'manager' | 'staff' | 'admin';

// Audience-gated single-doc reader (client, reads the docs store so admin-published docs
// resolve). A doc outside the viewer's audience 404s exactly like a missing one, so
// existence never leaks. `admin` sees any doc (it manages them).
export function DocReaderClient({ id, audience, skills = [], backHref }: {
  id: string;
  audience: Audience;
  skills?: string[];
  backHref: string;
}) {
  const { docs, ready } = useDocs();
  const doc = audience === 'admin' ? docs.find((d) => d.id === id)
    : audience === 'customer' ? docForCustomer(docs, id)
    : audience === 'manager' ? docForManager(docs, id)
    : docForStaff(docs, id, skills);

  if (!doc) {
    if (!ready) return <div className="mx-auto max-w-3xl py-16 text-center text-sm text-muted-foreground">Loading…</div>;
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="display text-lg font-bold">Doc not found</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been unpublished, or it isn’t shared with you.</p>
        <Link href={backHref} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">
          <i className="ph-bold ph-arrow-left" aria-hidden /> Back to docs
        </Link>
      </div>
    );
  }
  return <DocArticle doc={doc} backHref={backHref} />;
}
