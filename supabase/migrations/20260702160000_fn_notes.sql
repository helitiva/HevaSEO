-- Notes persistence: the notes table existed with SELECT-only RLS (owner reads own), but there was no
-- write path — the notebook ran on localStorage. Add owner-scoped upsert/delete via SECURITY DEFINER
-- functions (owner + tenant derived from JWT claims), so a note survives reloads and is truly private.

create or replace function upsert_note(p_id uuid, p_surface text, p_title text, p_body jsonb, p_color text)
returns notes
language plpgsql security definer
set search_path = public
as $$
declare
  v_note   notes;
  v_owner  uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
begin
  if v_owner is null or v_tenant is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into notes(id, tenant_id, owner_id, surface, title, body, color, created_at, updated_at)
       values (coalesce(p_id, gen_random_uuid()), v_tenant, v_owner, p_surface, p_title, coalesce(p_body, '{}'::jsonb), p_color, now(), now())
  on conflict (id) do update
       set title = excluded.title, body = excluded.body, color = excluded.color, updated_at = now()
     where notes.owner_id = v_owner          -- only the owner may update an existing note
  returning * into v_note;
  if v_note.id is null then raise exception 'NOT_OWNER'; end if;   -- id existed but owned by someone else
  return v_note;
end $$;

create or replace function delete_note(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from notes where id = p_id and owner_id = current_profile_id();
end $$;

revoke execute on function upsert_note(uuid, text, text, jsonb, text) from public, anon;
revoke execute on function delete_note(uuid) from public, anon;
grant  execute on function upsert_note(uuid, text, text, jsonb, text) to authenticated;
grant  execute on function delete_note(uuid) to authenticated;
