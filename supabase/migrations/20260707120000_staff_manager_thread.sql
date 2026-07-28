-- A real private manager↔staff message channel (was a mock local-only panel on the staff task detail).
-- One thread per staffer: the staffer and their pod manager both post to it. Money-blind by nature
-- (no money columns). gen_random_uuid() is a core Postgres function (no extension needed).
create table if not exists staff_manager_messages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  staff_id    uuid not null references profiles(id) on delete cascade,  -- whose thread
  author_id   uuid not null references profiles(id) on delete cascade,
  author_role text not null check (author_role in ('manager', 'staff')),
  body        text not null,
  created_at  timestamptz not null default now()
);
create index staff_manager_messages_staff_idx on staff_manager_messages (staff_id, created_at);
create index staff_manager_messages_tenant_idx on staff_manager_messages (tenant_id);

alter table staff_manager_messages enable row level security;
grant select on staff_manager_messages to authenticated;

-- a staffer reads their OWN thread
create policy smm_staff_own on staff_manager_messages
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'staff' and staff_id = current_profile_id());

-- a manager reads the threads of staff in THEIR pod
create policy smm_manager_pod on staff_manager_messages
  for select to authenticated
  using (
    tenant_id = current_tenant_id() and current_app_role() = 'manager'
    and exists (select 1 from staff_details sd where sd.profile_id = staff_id and sd.manager_id = current_profile_id())
  );

-- Post a message. A staffer always posts to their own thread (p_staff ignored → self). A manager posts to
-- one of their pod staffers (p_staff required, must be in their pod). author_role is derived, never trusted.
create or replace function post_staff_manager_message(p_staff uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role   text := current_app_role();
  v_tenant uuid := current_tenant_id();
  v_me     uuid := current_profile_id();
  v_staff  uuid;
begin
  if coalesce(btrim(p_body), '') = '' then raise exception 'EMPTY_BODY'; end if;
  if v_role = 'staff' then
    v_staff := v_me;
  elsif v_role = 'manager' then
    if p_staff is null then raise exception 'STAFF_REQUIRED'; end if;
    if not exists (select 1 from staff_details sd where sd.profile_id = p_staff and sd.manager_id = v_me and sd.tenant_id = v_tenant)
      then raise exception 'NOT_YOUR_POD'; end if;
    v_staff := p_staff;
  else
    raise exception 'NOT_AUTHORIZED';
  end if;
  insert into staff_manager_messages(tenant_id, staff_id, author_id, author_role, body)
       values (v_tenant, v_staff, v_me, v_role, btrim(p_body));
end $$;
revoke execute on function post_staff_manager_message(uuid, text) from public, anon;
grant  execute on function post_staff_manager_message(uuid, text) to authenticated;
