-- Lane E inc-E15: affiliate payout methods — the partner's own bank/paypal/wise/crypto destinations
-- (staff_payout_methods is staff/manager only). Mirrors that table's shape + "exactly one default" rules.
-- SELECT-only via RLS (admin all-tenant + affiliate-own via affiliates.user_id); writes go through the
-- claims-derived SECURITY DEFINER fns below.
create table affiliate_payout_methods (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  kind         text not null check (kind in ('bank', 'paypal', 'wise', 'crypto')),
  detail       text not null,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index affiliate_payout_methods_aff_idx on affiliate_payout_methods (affiliate_id);

alter table affiliate_payout_methods enable row level security;
grant select on affiliate_payout_methods to authenticated;

create policy affiliate_payout_methods_admin on affiliate_payout_methods
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy affiliate_payout_methods_own on affiliate_payout_methods
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'affiliate'
         and exists (select 1 from affiliates a where a.id = affiliate_payout_methods.affiliate_id and a.user_id = current_profile_id()));

-- add a method (first one, or an explicit default, becomes THE default and clears the others)
create or replace function add_affiliate_payout_method(p_kind text, p_detail text, p_make_default boolean)
returns affiliate_payout_methods
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_role   text := current_app_role();
  v_aff    uuid;
  v_first  boolean;
  v_row    affiliate_payout_methods;
begin
  if v_role <> 'affiliate' then raise exception 'NOT_AFFILIATE'; end if;
  if p_kind not in ('bank', 'paypal', 'wise', 'crypto') then raise exception 'INVALID_KIND'; end if;
  if coalesce(btrim(p_detail), '') = '' then raise exception 'INVALID_DETAIL'; end if;
  select id into v_aff from affiliates where user_id = current_profile_id() and tenant_id = v_tenant;
  if v_aff is null then raise exception 'NOT_AFFILIATE'; end if;

  v_first := not exists (select 1 from affiliate_payout_methods where affiliate_id = v_aff);
  if coalesce(p_make_default, false) or v_first then
    update affiliate_payout_methods set is_default = false where affiliate_id = v_aff;
  end if;
  insert into affiliate_payout_methods(tenant_id, affiliate_id, kind, detail, is_default)
       values (v_tenant, v_aff, p_kind, btrim(p_detail), coalesce(p_make_default, false) or v_first)
    returning * into v_row;
  return v_row;
end $$;

create or replace function set_default_affiliate_payout_method(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_tenant uuid := current_tenant_id(); v_role text := current_app_role(); v_aff uuid;
begin
  if v_role <> 'affiliate' then raise exception 'NOT_AFFILIATE'; end if;
  select id into v_aff from affiliates where user_id = current_profile_id() and tenant_id = v_tenant;
  if not exists (select 1 from affiliate_payout_methods where id = p_id and affiliate_id = v_aff)
    then raise exception 'METHOD_NOT_FOUND'; end if;
  update affiliate_payout_methods set is_default = (id = p_id) where affiliate_id = v_aff;
end $$;

create or replace function remove_affiliate_payout_method(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_tenant uuid := current_tenant_id(); v_role text := current_app_role(); v_aff uuid; v_was_def boolean; v_next uuid;
begin
  if v_role <> 'affiliate' then raise exception 'NOT_AFFILIATE'; end if;
  select id into v_aff from affiliates where user_id = current_profile_id() and tenant_id = v_tenant;
  delete from affiliate_payout_methods where id = p_id and affiliate_id = v_aff returning is_default into v_was_def;
  if not found then raise exception 'METHOD_NOT_FOUND'; end if;
  -- removing the default promotes the oldest remaining method (never left without a default)
  if v_was_def then
    select id into v_next from affiliate_payout_methods where affiliate_id = v_aff order by created_at limit 1;
    if v_next is not null then update affiliate_payout_methods set is_default = true where id = v_next; end if;
  end if;
end $$;

revoke execute on function add_affiliate_payout_method(text, text, boolean) from public;
revoke execute on function set_default_affiliate_payout_method(uuid) from public;
revoke execute on function remove_affiliate_payout_method(uuid) from public;
grant  execute on function add_affiliate_payout_method(text, text, boolean) to authenticated;
grant  execute on function set_default_affiliate_payout_method(uuid) to authenticated;
grant  execute on function remove_affiliate_payout_method(uuid) to authenticated;
