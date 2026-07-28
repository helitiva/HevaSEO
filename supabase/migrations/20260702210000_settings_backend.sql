-- Wire the remaining Settings tabs to real, customer-scoped Supabase storage.
--   • customer prefs (2FA flag, auto top-up, locale, timezone, avatar) via one safe SECURITY DEFINER fn
--   • API keys (sha256-hashed, shown once), webhooks, and payment-method metadata as RLS-scoped tables + fns
-- No third-party providers: payment_methods stores ONLY non-sensitive brand/last4/exp metadata (never a PAN);
-- 2FA is a persisted account preference (auth-layer enforcement is future work); plan changes are routed
-- through a real support ticket because a customer must never self-upgrade their own tier
-- (see update_my_profile — same rationale). All writes go through SECURITY DEFINER fns; tables grant SELECT only.

create extension if not exists pgcrypto;

-- ── customer preference columns ────────────────────────────────────────────────
alter table customers add column if not exists two_factor_enabled boolean not null default false;
alter table customers add column if not exists auto_topup jsonb;      -- { enabled, threshold, amount }
alter table customers add column if not exists locale text;
alter table customers add column if not exists avatar_url text;

-- The caller's own customer row id (null when the caller isn't a customer). SECURITY DEFINER so it can be
-- used inside RLS policies below without needing a blanket customers grant.
create or replace function current_customer_id() returns uuid
  language sql stable security definer set search_path = public
  as $$ select id from customers where user_id = current_profile_id() and tenant_id = current_tenant_id() limit 1 $$;
revoke execute on function current_customer_id() from public, anon;
grant  execute on function current_customer_id() to authenticated;

-- Partial-update writer for the safe preference columns (customer-only; coalesce = leave unset fields alone).
create or replace function set_my_settings(
  p_two_factor boolean default null, p_auto_topup jsonb default null,
  p_locale text default null, p_timezone text default null, p_avatar_url text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  update customers set
    two_factor_enabled = coalesce(p_two_factor,  two_factor_enabled),
    auto_topup         = coalesce(p_auto_topup,  auto_topup),
    locale             = coalesce(p_locale,      locale),
    timezone           = coalesce(p_timezone,    timezone),
    avatar_url         = coalesce(p_avatar_url,  avatar_url),
    last_active_at     = now()
  where user_id = current_profile_id() and tenant_id = current_tenant_id();
end $$;
revoke execute on function set_my_settings(boolean, jsonb, text, text, text) from public, anon;
grant  execute on function set_my_settings(boolean, jsonb, text, text, text) to authenticated;

-- ── API keys (hashed; the plaintext token is returned exactly once, at creation) ─
create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  label        text not null default 'Default',
  prefix       text not null,           -- display prefix, e.g. 'sk_live_'
  last4        text not null,           -- last 4 chars for identification
  token_hash   text not null,           -- sha256 hex of the full token; the plaintext is never stored
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists api_keys_customer_idx on api_keys (customer_id);
alter table api_keys enable row level security;
grant select on api_keys to authenticated;
create policy api_keys_read on api_keys for select to authenticated
  using (tenant_id = current_tenant_id()
    and (current_app_role() in ('admin', 'manager') or customer_id = current_customer_id()));

create or replace function create_api_key(p_label text default 'Default')
returns table (id uuid, token text, label text, last4 text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_cust uuid; v_tenant uuid; v_secret text; v_token text; v_id uuid;
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  v_cust := current_customer_id(); v_tenant := current_tenant_id();
  if v_cust is null then raise exception 'NO_CUSTOMER'; end if;
  v_secret := encode(gen_random_bytes(24), 'hex');
  v_token  := 'sk_live_' || v_secret;
  insert into api_keys (tenant_id, customer_id, label, prefix, last4, token_hash)
    values (v_tenant, v_cust, coalesce(nullif(btrim(p_label), ''), 'Default'),
            'sk_live_', right(v_secret, 4), encode(digest(v_token, 'sha256'), 'hex'))
    returning api_keys.id into v_id;
  return query
    select k.id, v_token, k.label, k.last4, k.created_at from api_keys k where k.id = v_id;
end $$;
revoke execute on function create_api_key(text) from public, anon;
grant  execute on function create_api_key(text) to authenticated;

create or replace function revoke_api_key(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  update api_keys set revoked_at = now()
   where id = p_id and customer_id = current_customer_id() and tenant_id = current_tenant_id()
     and revoked_at is null;
end $$;
revoke execute on function revoke_api_key(uuid) from public, anon;
grant  execute on function revoke_api_key(uuid) to authenticated;

-- ── webhooks (endpoint + subscribed events + signing secret) ────────────────────
create table if not exists webhooks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  url         text not null,
  events      text[] not null default '{}',
  secret      text not null default encode(gen_random_bytes(16), 'hex'),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists webhooks_customer_idx on webhooks (customer_id);
alter table webhooks enable row level security;
grant select on webhooks to authenticated;
create policy webhooks_read on webhooks for select to authenticated
  using (tenant_id = current_tenant_id()
    and (current_app_role() in ('admin', 'manager') or customer_id = current_customer_id()));

-- One endpoint per customer: update in place if present, else insert. Returns the row.
create or replace function upsert_webhook(p_url text, p_events text[] default '{}')
returns webhooks language plpgsql security definer set search_path = public as $$
declare v_cust uuid; v_tenant uuid; v_row webhooks;
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  if coalesce(btrim(p_url), '') = '' then raise exception 'EMPTY_URL'; end if;
  v_cust := current_customer_id(); v_tenant := current_tenant_id();
  update webhooks set url = p_url, events = coalesce(p_events, '{}'), active = true
    where customer_id = v_cust and tenant_id = v_tenant returning * into v_row;
  if not found then
    insert into webhooks (tenant_id, customer_id, url, events)
      values (v_tenant, v_cust, p_url, coalesce(p_events, '{}')) returning * into v_row;
  end if;
  return v_row;
end $$;
revoke execute on function upsert_webhook(text, text[]) from public, anon;
grant  execute on function upsert_webhook(text, text[]) to authenticated;

create or replace function delete_webhook(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  delete from webhooks where id = p_id and customer_id = current_customer_id() and tenant_id = current_tenant_id();
end $$;
revoke execute on function delete_webhook(uuid) from public, anon;
grant  execute on function delete_webhook(uuid) to authenticated;

-- ── payment methods (NON-sensitive metadata only — brand/last4/expiry; never a full card number) ─
create table if not exists payment_methods (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  brand       text not null,
  last4       text not null,
  exp_month   int,
  exp_year    int,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists payment_methods_customer_idx on payment_methods (customer_id);
alter table payment_methods enable row level security;
grant select on payment_methods to authenticated;
create policy payment_methods_read on payment_methods for select to authenticated
  using (tenant_id = current_tenant_id()
    and (current_app_role() in ('admin', 'manager') or customer_id = current_customer_id()));

create or replace function add_payment_method(p_brand text, p_last4 text, p_exp_month int default null, p_exp_year int default null)
returns payment_methods language plpgsql security definer set search_path = public as $$
declare v_cust uuid; v_tenant uuid; v_row payment_methods; v_first boolean;
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  if p_last4 !~ '^[0-9]{4}$' then raise exception 'BAD_LAST4'; end if;
  v_cust := current_customer_id(); v_tenant := current_tenant_id();
  select not exists (select 1 from payment_methods where customer_id = v_cust and tenant_id = v_tenant) into v_first;
  insert into payment_methods (tenant_id, customer_id, brand, last4, exp_month, exp_year, is_default)
    values (v_tenant, v_cust, coalesce(nullif(btrim(p_brand), ''), 'Card'), p_last4, p_exp_month, p_exp_year, v_first)
    returning * into v_row;
  return v_row;
end $$;
revoke execute on function add_payment_method(text, text, int, int) from public, anon;
grant  execute on function add_payment_method(text, text, int, int) to authenticated;

create or replace function set_default_payment_method(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_cust uuid; v_tenant uuid;
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  v_cust := current_customer_id(); v_tenant := current_tenant_id();
  update payment_methods set is_default = (id = p_id) where customer_id = v_cust and tenant_id = v_tenant;
end $$;
revoke execute on function set_default_payment_method(uuid) from public, anon;
grant  execute on function set_default_payment_method(uuid) to authenticated;

create or replace function remove_payment_method(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_cust uuid; v_tenant uuid; v_was_default boolean;
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  v_cust := current_customer_id(); v_tenant := current_tenant_id();
  delete from payment_methods where id = p_id and customer_id = v_cust and tenant_id = v_tenant
    returning is_default into v_was_default;
  -- if we removed the default, promote the newest remaining method
  if v_was_default then
    update payment_methods set is_default = true
     where id = (select id from payment_methods where customer_id = v_cust and tenant_id = v_tenant
                 order by created_at desc limit 1);
  end if;
end $$;
revoke execute on function remove_payment_method(uuid) from public, anon;
grant  execute on function remove_payment_method(uuid) to authenticated;
