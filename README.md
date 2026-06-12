# HevaSEO Platform (monorepo)

pnpm workspace that houses the HevaSEO web properties with a **shared design system**,
so chrome (header, footer, FAB) and tokens are edited once and stay in sync everywhere.

```
hevaseo-platform/
├─ apps/
│  ├─ web/        # Marketing + SEO site (Astro, static) → hevaseo.com
│  └─ app/        # Dashboard (Next.js) — Phase 2 → app.hevaseo.com  (placeholder)
└─ packages/
   └─ ui/         # Shared design tokens: Tailwind preset + CSS variables
```

## Why this structure

- **Astro** for the marketing site: ships ~0 JS, content lives in the HTML (great SEO),
  and gives real reusable components (`Header`, `Footer`, `Fab`, `BaseLayout`).
- **Next.js** for the dashboard (later): a real app framework for the authenticated,
  data-heavy product.
- **`packages/ui`** is the single source of truth for design tokens (brand/teal scale,
  shadcn-style color vars, fonts, radius), consumed by both apps so they look identical.

## Commands

```bash
pnpm install            # install everything (run once)

pnpm dev                # run the Astro marketing site (apps/web) in dev
pnpm build              # build apps/web to apps/web/dist (static)
pnpm preview            # preview the production build
```

(Each command proxies to `@heva/web`. From inside `apps/web` you can also run
`pnpm dev` / `pnpm build` directly.)

## apps/web (Astro)

- Pages: `src/pages/*.astro` → routes (`/`, `/audit`, `/seo-web-design`,
  `/keyword-strategy`, `/faq`, `/privacy`, `/terms`, `/blog`).
- Shared chrome: `src/layouts/BaseLayout.astro` + `src/components/*` —
  **edit the header/footer/FAB once, every page updates.**
- Site-wide data (nav links, contact, social): `src/data/site.ts`.
- Styles: `src/styles/global.css` (imports `@heva/ui/tokens.css` + the migrated
  component CSS). Tailwind config in `tailwind.config.cjs` extends the shared preset.
- Blog: Markdown files in `src/content/blog/*.md` (add a file = add a post).
- Legacy interactive bits (`public/app.js`, `public/effects.js`) are loaded per page.

## Language

The site is **English-only**, targeting the US market (decided 2026-06-12).
