-- Lane E inc-E16: affiliate click tracking. The partner's shared link routes through the app's /r/:code
-- endpoint, which records a click (timestamped row + denormalized affiliates.clicks counter the funnel/
-- KPIs read) then redirects to the marketing site. record_affiliate_click is callable by ANON (a click
-- has no session); it's SECURITY DEFINER so it resolves the code + writes despite RLS, and returns void
-- (never reveals whether a code exists). NOTE: no dedup/rate-limit yet — abuse hardening is a follow-up.
create table affiliate_clicks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index affiliate_clicks_aff_idx on affiliate_clicks (affiliate_id, created_at);

alter table affiliate_clicks enable row level security;
grant select on affiliate_clicks to authenticated;

-- read for analytics: admin (all tenant) + affiliate-own
create policy affiliate_clicks_admin on affiliate_clicks
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy affiliate_clicks_own on affiliate_clicks
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'affiliate'
         and exists (select 1 from affiliates a where a.id = affiliate_clicks.affiliate_id and a.user_id = current_profile_id()));

create or replace function record_affiliate_click(p_code text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_aff uuid; v_tenant uuid;
begin
  if p_code is null then return; end if;
  select id, tenant_id into v_aff, v_tenant from affiliates where code = upper(p_code) limit 1;
  if v_aff is null then return; end if;  -- silent: don't reveal which codes exist
  insert into affiliate_clicks(tenant_id, affiliate_id) values (v_tenant, v_aff);
  update affiliates set clicks = clicks + 1 where id = v_aff;
end $$;

revoke execute on function record_affiliate_click(text) from public;
grant  execute on function record_affiliate_click(text) to anon, authenticated;
