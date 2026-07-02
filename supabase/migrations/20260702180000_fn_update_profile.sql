-- Profile settings: let a customer edit their own profile + billing. A SECURITY DEFINER fn updates ONLY
-- the safe columns (never tier/status/referrer), so we don't need a blanket UPDATE grant that would let a
-- customer self-upgrade their tier. Adds the two profile columns the settings form needs.

alter table customers add column if not exists website  text;
alter table customers add column if not exists industry text;

create or replace function update_my_profile(
  p_name text default null, p_phone text default null, p_company text default null,
  p_industry text default null, p_website text default null, p_billing jsonb default null
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  update customers set
    name     = coalesce(p_name,     name),
    phone    = coalesce(p_phone,    phone),
    company  = coalesce(p_company,  company),
    industry = coalesce(p_industry, industry),
    website  = coalesce(p_website,  website),
    billing  = coalesce(p_billing,  billing),
    last_active_at = now()
  where user_id = current_profile_id() and tenant_id = current_tenant_id();
end $$;

revoke execute on function update_my_profile(text, text, text, text, text, jsonb) from public, anon;
grant  execute on function update_my_profile(text, text, text, text, text, jsonb) to authenticated;
