-- Privileged-invite claim primitive (companion to 20260701450000). Since handle_new_user no longer
-- auto-claims privileged shadows via bare self-signup, admin provisioning must link the invited
-- profile to a freshly-created auth user explicitly. This SECURITY DEFINER fn (service-role only, the
-- same trust level as auth.admin.createUser) links the unclaimed shadow for an email to the given auth
-- user. Called by the admin provisioning server actions after they createUser() with a temp password.
create or replace function claim_invite(p_email text, p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_n int;
begin
  update profiles set user_id = p_user_id, status = 'active'
   where email = p_email and user_id is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'NO_INVITE'; end if;  -- no unclaimed shadow for this email
end $$;

revoke execute on function claim_invite(text, uuid) from public;
grant  execute on function claim_invite(text, uuid) to service_role;
