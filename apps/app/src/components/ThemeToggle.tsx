'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      aria-label="Toggle light/dark theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
    >
      {/* icons are CSS-driven by the .dark class; render after mount to avoid hydration mismatch */}
      {mounted && (
        <>
          <i className="ph-bold ph-sun-dim hidden text-lg dark:block" aria-hidden />
          <i className="ph-bold ph-moon-stars block text-lg dark:hidden" aria-hidden />
        </>
      )}
    </button>
  );
}
