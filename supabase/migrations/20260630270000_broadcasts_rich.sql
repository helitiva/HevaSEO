-- Lane C inc-C4: enrich the broadcasts table to match the recipient UI model (the mock Broadcast carries
-- more than the minimal E0b table). Additive columns only — existing RLS (admin + recipient-by-audience)
-- is unchanged. `display_kind` carries the 6 UI tones (the coarse `kind` enum stays for analytics).
alter table broadcasts
  add column banner       boolean not null default false,   -- also surface as an overview banner popup
  add column pinned       boolean not null default false,
  add column cta          jsonb,                            -- { label, href } | null
  add column article      text,                             -- optional long-form sanitized HTML
  add column expires_at   timestamptz,                      -- past = no longer delivered
  add column require_ack  boolean not null default false,
  add column updated_at   timestamptz,
  add column display_kind text not null default 'notice'
    check (display_kind in ('congrats', 'notice', 'info', 'warning', 'maintenance', 'outage'));
