-- Lane E inc-E12: affiliate marketing metadata — platform / niche / audience / clicks, previously
-- untabled (readers defaulted them to '—' / 0). Columns live on affiliates; the affiliate edits their
-- OWN profile via a claims-derived fn (affiliates is SELECT-only via RLS). clicks has no live pipeline
-- yet (seeded for the funnel/KPIs; no increment path) — a tracking follow-up.
alter table affiliates
  add column if not exists platform text,
  add column if not exists niche    text,
  add column if not exists audience text,
  add column if not exists clicks   int not null default 0;

-- The signed-in affiliate updates their own marketing profile (platform/niche/audience).
create or replace function update_affiliate_profile(p_platform text, p_niche text, p_audience text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_pid    uuid := current_profile_id();
  v_role   text := current_app_role();
  v_aff    uuid;
begin
  if v_role <> 'affiliate' then raise exception 'NOT_AFFILIATE'; end if;
  update affiliates set platform = p_platform, niche = p_niche, audience = p_audience
   where user_id = v_pid and tenant_id = v_tenant
   returning id into v_aff;
  if v_aff is null then raise exception 'NOT_AFFILIATE'; end if;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'affiliate.profile.update', 'affiliate', v_aff);
end $$;

revoke execute on function update_affiliate_profile(text, text, text) from public;
grant  execute on function update_affiliate_profile(text, text, text) to authenticated;
