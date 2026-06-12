# @heva/app — Dashboard (Next.js) · Phase 2

This app will house the **authenticated product dashboard** (Overview, Projects,
Orders, Credit, Settings, Support) built with **Next.js**.

It is intentionally a placeholder for now. The current dashboard in `HevaSEOen/`
is a static mockup; the real app will be rebuilt here with auth, real data, and an API.

When starting Phase 2:

- Scaffold Next.js (App Router) in this folder as `@heva/app`.
- Reuse the shared design system from `packages/ui`:
  - `@heva/ui/tailwind-preset` in `tailwind.config`
  - `@heva/ui/tokens.css` imported in the root layout
- Keep it on a subdomain (e.g. `app.hevaseo.com`); the marketing site (`apps/web`,
  Astro) stays on `hevaseo.com`.
- Talk to a separate API for data so the frontend stays swappable.
