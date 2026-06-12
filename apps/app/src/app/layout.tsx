import type { Metadata } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import './dashboard.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-inter-tight',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'HevaSEO Workspace', template: '%s · HevaSEO Workspace' },
  description: 'Manage your SEO services: orders, projects, credits, and reports.',
  robots: { index: false, follow: false }, // app pages are private
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${interTight.variable} bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          storageKey="heva-theme-blue"
        >
          {children}
        </ThemeProvider>
        {/* Phosphor icon font (same icon set as the marketing site).
            TODO(self-host): swap for a local copy or @phosphor-icons/react. */}
        <Script src="https://unpkg.com/@phosphor-icons/web@2.1.1" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
