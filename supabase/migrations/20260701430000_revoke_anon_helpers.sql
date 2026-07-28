-- SECURITY (LOW) — tighten EXECUTE on SECURITY DEFINER helpers/triggers that defaulted to PUBLIC.
--
-- order_assignee_id / order_pod_manager are RLS-bypass lookups called INSIDE policies, so the
-- `authenticated` role must keep EXECUTE (policy evaluation runs as the querying role). But `anon`
-- never needs them (no anon policy references them) → drop the implicit public grant and re-grant to
-- authenticated only. This removes a minor anon info-disclosure surface (resolve an order's assignee /
-- pod-manager id by order uuid).
revoke execute on function order_assignee_id(uuid) from public;
revoke execute on function order_pod_manager(uuid) from public;
grant  execute on function order_assignee_id(uuid) to authenticated;
grant  execute on function order_pod_manager(uuid) to authenticated;

-- handle_new_user / sync_profile_email are TRIGGER functions. Triggers fire internally as the table
-- owner and do NOT require the invoking role to hold EXECUTE, so no API role ever needs to call them
-- directly. Remove the implicit public grant (defence-in-depth; the triggers keep firing unchanged).
revoke execute on function handle_new_user()    from public;
revoke execute on function sync_profile_email() from public;
