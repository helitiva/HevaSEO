-- Lane C inc-C3: admin doc authoring — create/edit/unpublish docs. The docs table is SELECT-only via
-- RLS (readers), so writes go through these admin-gated SECURITY DEFINER fns (claims-derived tenant +
-- author, like the Lane D money fns). HTML in p_body is sanitized server-side (Node action) before it
-- reaches here. audiences must be a subset of the role audiences; required_skills gate the staff audience.
create or replace function upsert_doc(
  p_title text, p_body jsonb, p_audiences text[], p_required_skills text[], p_pinned boolean, p_id uuid default null
) returns docs
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
  v_row    docs;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'INVALID_TITLE'; end if;
  if p_audiences is null or cardinality(p_audiences) = 0 then raise exception 'NO_AUDIENCE'; end if;
  if not (p_audiences <@ array['customer','staff','manager']::text[]) then raise exception 'INVALID_AUDIENCE'; end if;

  if p_id is null then
    insert into docs(tenant_id, title, body, audiences, required_skills, pinned, author_id)
         values (v_tenant, btrim(p_title), coalesce(p_body, '{}'::jsonb), p_audiences,
                 coalesce(p_required_skills, '{}'), coalesce(p_pinned, false), v_actor)
      returning * into v_row;
  else
    update docs
       set title = btrim(p_title), body = coalesce(p_body, '{}'::jsonb), audiences = p_audiences,
           required_skills = coalesce(p_required_skills, '{}'), pinned = coalesce(p_pinned, false),
           updated_at = now()
     where id = p_id and tenant_id = v_tenant
   returning * into v_row;
    if not found then raise exception 'DOC_NOT_FOUND'; end if;
  end if;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, case when p_id is null then 'doc.create' else 'doc.update' end, 'doc', v_row.id);
  return v_row;
end $$;

create or replace function delete_doc(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor  uuid := current_profile_id();
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  delete from docs where id = p_id and tenant_id = v_tenant;
  if not found then raise exception 'DOC_NOT_FOUND'; end if;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'doc.delete', 'doc', p_id);
end $$;

revoke execute on function upsert_doc(text, jsonb, text[], text[], boolean, uuid) from public;
revoke execute on function delete_doc(uuid) from public;
grant  execute on function upsert_doc(text, jsonb, text[], text[], boolean, uuid) to authenticated;
grant  execute on function delete_doc(uuid) to authenticated;
