-- Deliverable "seen by customer" + edit-until-viewed. Non-money, additive.
--
-- viewed_at records when the customer first opened the delivered work. It drives two behaviours:
--   (a) a "seen by customer" indicator on the staff / manager / admin surfaces;
--   (b) the edit-vs-revision rule — staff may correct the delivered work IN PLACE (same version) until the
--       customer has viewed it; afterwards a change must be a new version (revision), which re-enters review.
alter table deliverables add column if not exists viewed_at timestamptz;

-- Customer marks the delivered work as viewed (own order only, customer role only). Idempotent: only fills
-- nulls, on the approved (delivered) versions the customer is allowed to see. SECURITY DEFINER because
-- deliverables is SELECT-only to the customer via RLS.
create or replace function mark_deliverable_viewed(p_order uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_pid    uuid := current_profile_id();
begin
  if current_app_role() <> 'customer' then return; end if;  -- only the customer "views"; no-op otherwise
  update deliverables d
     set viewed_at = now()
   where d.order_id = p_order
     and d.tenant_id = v_tenant
     and d.status = 'approved'
     and d.viewed_at is null
     and exists (
       select 1 from orders o join customers c on c.id = o.customer_id
        where o.id = d.order_id and c.user_id = v_pid
     );
end $$;
revoke execute on function mark_deliverable_viewed(uuid) from public;
grant  execute on function mark_deliverable_viewed(uuid) to authenticated;

-- Staff corrects their delivered deliverable IN PLACE — allowed only while the customer hasn't viewed it.
-- Once viewed_at is set this raises ALREADY_VIEWED and the caller must submit a new version instead.
create or replace function edit_deliverable(p_deliverable uuid, p_summary text, p_files jsonb default '[]')
returns deliverables
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_pid    uuid := current_profile_id();
  v_row    deliverables;
begin
  if current_app_role() <> 'staff' then raise exception 'NOT_STAFF'; end if;
  select * into v_row from deliverables
    where id = p_deliverable and tenant_id = v_tenant and submitter_id = v_pid for update;
  if not found then raise exception 'NOT_YOUR_DELIVERABLE'; end if;
  if v_row.viewed_at is not null then raise exception 'ALREADY_VIEWED'; end if;
  update deliverables
     set summary = nullif(btrim(coalesce(p_summary, '')), ''),
         files   = coalesce(p_files, '[]'::jsonb)
   where id = p_deliverable
   returning * into v_row;
  insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_pid, 'deliverable.edited', 'order', v_row.order_id);
  return v_row;
end $$;
revoke execute on function edit_deliverable(uuid, text, jsonb) from public;
grant  execute on function edit_deliverable(uuid, text, jsonb) to authenticated;
