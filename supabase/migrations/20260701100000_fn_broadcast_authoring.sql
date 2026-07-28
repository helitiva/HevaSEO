-- Lane C inc-C5: admin broadcast authoring — compose/send/edit, recall/restore, delete. Same pattern as
-- the doc authoring fns (admin-gated, claims-derived tenant + author; broadcasts is SELECT-only via RLS
-- so writes go through these SECURITY DEFINER fns). HTML article is sanitized client-side at the composer.
create or replace function upsert_broadcast(
  p_title text, p_body text, p_audiences text[], p_display_kind text,
  p_banner boolean, p_pinned boolean, p_require_ack boolean, p_status text,
  p_cta jsonb default null, p_article text default null,
  p_scheduled_at timestamptz default null, p_expires_at timestamptz default null,
  p_id uuid default null
) returns broadcasts
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
  v_row    broadcasts;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'INVALID_TITLE'; end if;
  if p_audiences is null or cardinality(p_audiences) = 0 then raise exception 'NO_AUDIENCE'; end if;
  if not (p_audiences <@ array['customer','staff','manager','affiliate']::text[]) then raise exception 'INVALID_AUDIENCE'; end if;
  if p_display_kind not in ('congrats','notice','info','warning','maintenance','outage') then raise exception 'INVALID_KIND'; end if;
  if p_status not in ('draft','scheduled','live','recalled') then raise exception 'INVALID_STATUS'; end if;

  if p_id is null then
    insert into broadcasts(tenant_id, title, body, audiences, display_kind, banner, pinned, cta, article,
                           scheduled_at, expires_at, require_ack, status, created_by_id)
         values (v_tenant, btrim(p_title), p_body, p_audiences, p_display_kind, coalesce(p_banner,false),
                 coalesce(p_pinned,false), p_cta, p_article, p_scheduled_at, p_expires_at,
                 coalesce(p_require_ack,false), p_status::broadcast_status, v_actor)
      returning * into v_row;
  else
    update broadcasts
       set title = btrim(p_title), body = p_body, audiences = p_audiences, display_kind = p_display_kind,
           banner = coalesce(p_banner,false), pinned = coalesce(p_pinned,false), cta = p_cta, article = p_article,
           scheduled_at = p_scheduled_at, expires_at = p_expires_at, require_ack = coalesce(p_require_ack,false),
           status = p_status::broadcast_status, updated_at = now()
     where id = p_id and tenant_id = v_tenant
   returning * into v_row;
    if not found then raise exception 'BROADCAST_NOT_FOUND'; end if;
  end if;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, case when p_id is null then 'broadcast.send' else 'broadcast.update' end, 'broadcast', v_row.id);
  return v_row;
end $$;

-- recall (status='recalled') / restore (status='live') — admin, own tenant.
create or replace function set_broadcast_status(p_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_tenant uuid := current_tenant_id(); v_actor uuid := current_profile_id();
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if p_status not in ('draft','scheduled','live','recalled') then raise exception 'INVALID_STATUS'; end if;
  update broadcasts set status = p_status::broadcast_status, updated_at = now() where id = p_id and tenant_id = v_tenant;
  if not found then raise exception 'BROADCAST_NOT_FOUND'; end if;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'broadcast.' || p_status, 'broadcast', p_id);
end $$;

create or replace function delete_broadcast(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_tenant uuid := current_tenant_id(); v_actor uuid := current_profile_id();
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  delete from broadcasts where id = p_id and tenant_id = v_tenant;
  if not found then raise exception 'BROADCAST_NOT_FOUND'; end if;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'broadcast.delete', 'broadcast', p_id);
end $$;

revoke execute on function upsert_broadcast(text, text, text[], text, boolean, boolean, boolean, text, jsonb, text, timestamptz, timestamptz, uuid) from public;
revoke execute on function set_broadcast_status(uuid, text) from public;
revoke execute on function delete_broadcast(uuid) from public;
grant  execute on function upsert_broadcast(text, text, text[], text, boolean, boolean, boolean, text, jsonb, text, timestamptz, timestamptz, uuid) to authenticated;
grant  execute on function set_broadcast_status(uuid, text) to authenticated;
grant  execute on function delete_broadcast(uuid) to authenticated;
