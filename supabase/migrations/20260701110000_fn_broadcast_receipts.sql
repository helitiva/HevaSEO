-- Lane C inc-C6: real broadcast read-receipts. A recipient marks a message read/clicked → an append-only
-- broadcast_events row (the E0b table: kind sent/read/click, RLS admin-all + user-own). broadcast_events
-- is SELECT-only via RLS, so writes go through these SECURITY DEFINER fns (claims-derived user; the caller
-- must be a real recipient of the broadcast — role in its audiences, same tenant). Read + click are
-- idempotent per (user, broadcast) so re-marking doesn't inflate counts.
create or replace function mark_broadcast_read(p_broadcast uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := current_tenant_id(); v_pid uuid := current_profile_id(); v_role text := current_app_role();
begin
  if not exists (select 1 from broadcasts where id = p_broadcast and tenant_id = v_tenant and v_role = any(audiences))
    then raise exception 'NOT_A_RECIPIENT'; end if;
  if not exists (select 1 from broadcast_events where broadcast_id = p_broadcast and user_id = v_pid and kind = 'read') then
    insert into broadcast_events(tenant_id, broadcast_id, user_id, kind) values (v_tenant, p_broadcast, v_pid, 'read');
  end if;
end $$;

create or replace function mark_broadcast_click(p_broadcast uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := current_tenant_id(); v_pid uuid := current_profile_id(); v_role text := current_app_role();
begin
  if not exists (select 1 from broadcasts where id = p_broadcast and tenant_id = v_tenant and v_role = any(audiences))
    then raise exception 'NOT_A_RECIPIENT'; end if;
  -- a click implies a read
  if not exists (select 1 from broadcast_events where broadcast_id = p_broadcast and user_id = v_pid and kind = 'read') then
    insert into broadcast_events(tenant_id, broadcast_id, user_id, kind) values (v_tenant, p_broadcast, v_pid, 'read');
  end if;
  if not exists (select 1 from broadcast_events where broadcast_id = p_broadcast and user_id = v_pid and kind = 'click') then
    insert into broadcast_events(tenant_id, broadcast_id, user_id, kind) values (v_tenant, p_broadcast, v_pid, 'click');
  end if;
end $$;

revoke execute on function mark_broadcast_read(uuid) from public;
revoke execute on function mark_broadcast_click(uuid) from public;
grant  execute on function mark_broadcast_read(uuid) to authenticated;
grant  execute on function mark_broadcast_click(uuid) to authenticated;
