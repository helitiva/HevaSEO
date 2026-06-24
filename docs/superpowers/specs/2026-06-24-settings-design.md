# Spec — Settings (Admin module 13)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Audience:** Master admin.

Global configuration: email templates, SLA rules, third-party integrations, admin accounts, and the
tunable constants the other modules read.

---

## 1. Scope

**In scope:** a settings store; email templates; SLA targets (per priority); integration configs
(Stripe/SMTP/Turnstile — non-secret references); **admin account** management; surfacing the tunable
constants (`ROUTING_CONFIG`, `SCORING_CONFIG`, catalog publish) for editing.

**Out of scope:** secrets stay in env (`.env` / secret manager), never in the DB; the customer
portal settings.

## 2. Dependencies

- `profiles` (Foundation) for admin accounts. SLA values consumed by Ticket (5) + Order SLA (2).
  Email templates consumed by Messaging (10) + Finance (9) touchpoints.

## 3. Data model

```sql
settings (
  key        text primary key,        -- e.g. 'sla.ticket.high', 'routing', 'scoring'
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
)
email_templates (
  id         text primary key,        -- 'order_confirmed', 'deliverable_ready', ...
  subject    text not null,
  body_mjml  text not null,           -- React Email / MJML source
  updated_at timestamptz not null default now()
)
```

- Tunable constants (`ROUTING_CONFIG`, `SCORING_CONFIG`) live as code defaults but can be overridden
  by a `settings` row (`routing`, `scoring`) so they're editable without a deploy — the modules read
  `getSetting(key) ?? DEFAULT`.

## 4. Admin accounts

- Master admin can invite/create other admin accounts (Supabase Auth + a `profiles` row,
  `role = master_admin` for now; staff roles when the 3-role system lands).
- `inviteAdmin(email)` sends a Supabase invite; `deactivateAdmin(id)` flags the profile.

## 5. UI

- `/admin/settings`: tabbed —
  - **General**: business info, currency display.
  - **SLA**: targets per priority (orders + tickets).
  - **Routing & scoring**: editable `ROUTING_CONFIG` / `SCORING_CONFIG` (the tunables flagged
    "optimize after trial" in modules 3 & 7).
  - **Email templates**: edit subject/body, preview.
  - **Integrations**: Stripe/SMTP/Turnstile presence + non-secret config (keys via env).
  - **Admins**: list, invite, deactivate.

## 6. Server actions

- `setSetting(key, value)` / `getSetting(key)`.
- `upsertEmailTemplate(id, { subject, bodyMjml })`.
- `inviteAdmin(email)` / `deactivateAdmin(id)`.

## 7. Testing

- **Unit:** `getSetting` falls back to code defaults; SLA lookup by priority.
- **Integration:** overriding `routing`/`scoring` via settings changes module 3/7 behavior; invite
  creates an auth user + profile.

## 8. Open (later)

- Role/permission editor (when 3-role lands); audit of settings changes (module 12); template
  versioning; per-environment config.
