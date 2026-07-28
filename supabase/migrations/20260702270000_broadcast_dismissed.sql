-- Durable per-account banner dismissal. Dismissing an overview banner was localStorage-only (per-browser,
-- lost on reseed). Record it as a real append-only broadcast_events row (kind 'dismissed') so it survives
-- across devices/sessions, alongside read/click receipts. Dismiss implies read (like click).
alter table broadcast_events drop constraint if exists broadcast_events_kind_check;
alter table broadcast_events add constraint broadcast_events_kind_check
  check (kind in ('sent', 'read', 'click', 'dismissed'));

create or replace function mark_broadcast_dismissed(p_broadcast uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := current_tenant_id(); v_pid uuid := current_profile_id(); v_role text := current_app_role();
begin
  if not exists (select 1 from broadcasts where id = p_broadcast and tenant_id = v_tenant and v_role = any(audiences))
    then raise exception 'NOT_A_RECIPIENT'; end if;
  if not exists (select 1 from broadcast_events where broadcast_id = p_broadcast and user_id = v_pid and kind = 'read') then
    insert into broadcast_events(tenant_id, broadcast_id, user_id, kind) values (v_tenant, p_broadcast, v_pid, 'read');
  end if;
  if not exists (select 1 from broadcast_events where broadcast_id = p_broadcast and user_id = v_pid and kind = 'dismissed') then
    insert into broadcast_events(tenant_id, broadcast_id, user_id, kind) values (v_tenant, p_broadcast, v_pid, 'dismissed');
  end if;
end $$;
revoke execute on function mark_broadcast_dismissed(uuid) from public;
grant  execute on function mark_broadcast_dismissed(uuid) to authenticated;
