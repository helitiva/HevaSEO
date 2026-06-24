import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build
export default defineConfig({
  site: 'https://hevaseo.com',
  // Transpile the shared TS catalog package (consumed as source, not pre-built).
  vite: { ssr: { noExternal: ['@heva/catalog'] } },
  integrations: [
    // We provide our own global.css (with tokens + @tailwind directives),
    // so disable the integration's injected base stylesheet.
    tailwind({ applyBaseStyles: false }),
    sitemap(),
  ],
});
