-- Lane E inc-E18: keep profiles.email in sync when a user changes their sign-in email. The email change
-- itself goes through GoTrue's verified flow (auth.updateUser → confirmation link → auth.users.email
-- updates); this trigger mirrors the confirmed change onto the linked profile (profiles.email is a
-- separate citext column, unique per tenant). The claims hook resolves by user_id, not email, so claims
-- never break. SECURITY DEFINER + pinned search_path so it can write profiles.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where user_id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
