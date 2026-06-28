import { DocsLibrary } from '@/components/docs/DocsLibrary';

export const metadata = { title: 'Docs & guides' };

export default function CustomerDocsPage() {
  return (
    <section>
      <header className="mb-5">
        <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Docs &amp; guides</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tutorials, tips and how-tos from the HevaSEO team.</p>
      </header>
      <DocsLibrary audience="customer" />
    </section>
  );
}
