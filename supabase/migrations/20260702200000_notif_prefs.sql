-- Notification preferences: persist the settings toggles to the customer's own row (was localStorage).
alter table customers add column if not exists notif_prefs jsonb not null default '{}'::jsonb;

create or replace function set_notif_prefs(p_notif jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_CUSTOMER'; end if;
  update customers set notif_prefs = coalesce(p_notif, '{}'::jsonb)
   where user_id = current_profile_id() and tenant_id = current_tenant_id();
end $$;

revoke execute on function set_notif_prefs(jsonb) from public, anon;
grant  execute on function set_notif_prefs(jsonb) to authenticated;
