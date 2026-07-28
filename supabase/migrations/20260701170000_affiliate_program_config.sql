-- Lane E inc-E7: affiliate program config — the Rules tab's program rules + commission-tier definitions,
-- persisted per-tenant (was localStorage-only). Two tables, both SELECT-only via RLS (admin read); all
-- writes go through admin-gated SECURITY DEFINER upserts. NOTE: this stores the authored config; the live
-- program fns (e.g. request_affiliate_payout min) don't read it yet — enforcement is a follow-up.

create table affiliate_program_config (
  tenant_id           uuid primary key references tenants(id) on delete cascade,
  approval_mode       text    not null default 'instant'  check (approval_mode in ('instant', 'manual')),
  attribution         text    not null default 'lifetime' check (attribution in ('lifetime', 'window')),
  cookie_window_days  int     not null default 60 check (cookie_window_days >= 1),
  hold_days           int     not null default 14 check (hold_days >= 0),
  min_payout          numeric(12,2) not null default 50 check (min_payout >= 0),
  self_referral_block boolean not null default true,
  recurring           boolean not null default true,
  updated_at          timestamptz not null default now()
);

create table affiliate_tier_config (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  tier       affiliate_tier not null,
  min_volume numeric(12,2) not null default 0 check (min_volume >= 0),
  rate       numeric(5,4)  not null default 0 check (rate >= 0 and rate <= 1),
  primary key (tenant_id, tier)
);

alter table affiliate_program_config enable row level security;
alter table affiliate_tier_config    enable row level security;

-- Base table grant (RLS still gates rows to admin-own-tenant); writes go through the SECURITY DEFINER fns.
grant select on affiliate_program_config to authenticated;
grant select on affiliate_tier_config    to authenticated;

-- Admin-only surface (program-wide config). Reads scoped to own tenant; writes via the fns below.
create policy affiliate_program_config_admin_read on affiliate_program_config
  for select using (current_app_role() = 'admin' and tenant_id = current_tenant_id());
create policy affiliate_tier_config_admin_read on affiliate_tier_config
  for select using (current_app_role() = 'admin' and tenant_id = current_tenant_id());

-- Upsert the program rules (one row per tenant). Check constraints reject bad enum-ish values.
create or replace function upsert_affiliate_program_config(
  p_approval_mode text, p_attribution text, p_cookie_window_days int,
  p_hold_days int, p_min_payout numeric, p_self_referral_block boolean, p_recurring boolean
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  insert into affiliate_program_config
    (tenant_id, approval_mode, attribution, cookie_window_days, hold_days, min_payout, self_referral_block, recurring, updated_at)
  values
    (v_tenant, p_approval_mode, p_attribution, p_cookie_window_days, p_hold_days, p_min_payout, p_self_referral_block, p_recurring, now())
  on conflict (tenant_id) do update set
    approval_mode = excluded.approval_mode, attribution = excluded.attribution,
    cookie_window_days = excluded.cookie_window_days, hold_days = excluded.hold_days,
    min_payout = excluded.min_payout, self_referral_block = excluded.self_referral_block,
    recurring = excluded.recurring, updated_at = now();
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'affiliate.rules.update', 'affiliate_program_config', v_tenant);
end $$;

-- Replace all tier definitions in one call (p_tiers = jsonb array of {tier, min_volume, rate}).
create or replace function upsert_affiliate_tier_config(p_tiers jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
  r jsonb;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if jsonb_typeof(p_tiers) <> 'array' then raise exception 'BAD_TIERS'; end if;
  for r in select value from jsonb_array_elements(p_tiers) loop
    insert into affiliate_tier_config (tenant_id, tier, min_volume, rate)
    values (v_tenant, (r->>'tier')::affiliate_tier, (r->>'min_volume')::numeric, (r->>'rate')::numeric)
    on conflict (tenant_id, tier) do update set
      min_volume = excluded.min_volume, rate = excluded.rate;
  end loop;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'affiliate.tiers.update', 'affiliate_tier_config', v_tenant);
end $$;

revoke execute on function upsert_affiliate_program_config(text, text, int, int, numeric, boolean, boolean) from public;
grant  execute on function upsert_affiliate_program_config(text, text, int, int, numeric, boolean, boolean) to authenticated;
revoke execute on function upsert_affiliate_tier_config(jsonb) from public;
grant  execute on function upsert_affiliate_tier_config(jsonb) to authenticated;
