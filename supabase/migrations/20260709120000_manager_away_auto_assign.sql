-- Manager "away → auto-assign". A manager flips an away toggle in their header; while it is on, any newly
-- placed order their pod can serve is routed automatically to the least-loaded suitable staffer (skill match),
-- and the current unassigned queue is swept the moment they turn it on.
--
-- profiles has no self-UPDATE RLS policy and orders are SELECT-only via RLS, so every write goes through a
-- SECURITY DEFINER fn. auto_assign_order is service_role-only (called from placeOrderAction at order creation);
-- the manager-facing toggle + self-read are claims-derived (manager only).

alter table profiles add column if not exists away_auto_assign boolean not null default false;

-- Order service label → the staff skill token that delivers it. Tolerant of the label variants actually
-- stored ("Keywords"/"Keyword", "Web Design"/"Design", Audit/Indexer → optimize).
create or replace function service_skill(p_service text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_service ilike 'backlink%'                               then 'backlink'
    when p_service ilike 'keyword%'                                then 'keyword'
    when p_service ilike 'content%'                                then 'content'
    when p_service ilike 'design%' or p_service ilike 'web design%' then 'content'
    when p_service ilike 'optim%' or p_service ilike 'audit%' or p_service ilike 'index%' then 'optimize'
    else null
  end;
$$;

-- Auto-route ONE unassigned order to the best staffer inside any away-manager's pod. Returns the chosen staff
-- profile id, or null if the order is already assigned/closed, its skill is unknown, or no away pod can serve
-- it. Best staffer = has the skill + active; prefers under-capacity, then least active load, then bigger cap.
create or replace function auto_assign_order(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tenant   uuid;
  v_service  text;
  v_state    order_state;
  v_assignee uuid;
  v_skill    text;
  v_staff    uuid;
  v_manager  uuid;
begin
  select tenant_id, service, state, assignee_id into v_tenant, v_service, v_state, v_assignee
    from orders where id = p_order for update;
  if not found then return null; end if;
  if v_assignee is not null or v_state not in ('new', 'confirmed') then return null; end if;

  v_skill := service_skill(v_service);
  if v_skill is null then return null; end if;

  select sd.profile_id, mgr.id into v_staff, v_manager
    from staff_details sd
    join profiles mgr on mgr.id = sd.manager_id
    cross join lateral (
      select count(*)::int as load from orders o
       where o.assignee_id = sd.profile_id
         and o.state in ('assigned', 'in_progress', 'internal_review', 'changes_requested')
    ) l
   where sd.tenant_id = v_tenant and sd.active
     and mgr.tenant_id = v_tenant and mgr.role = 'manager' and mgr.away_auto_assign
     and v_skill = any(sd.skills)
   order by (case when l.load >= sd.capacity then 1 else 0 end), l.load, sd.capacity desc
   limit 1;
  if v_staff is null then return null; end if;

  update orders
     set assignee_id = v_staff,
         state = case when state in ('new', 'confirmed') then 'assigned'::order_state else state end
   where id = p_order and tenant_id = v_tenant;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_manager, 'order.auto_assign', 'order', p_order);
  return v_staff;
end $$;
revoke execute on function auto_assign_order(uuid) from public;
grant  execute on function auto_assign_order(uuid) to service_role;

-- The manager flips their own away/auto-assign flag. Turning it ON also sweeps the current unassigned queue
-- through auto_assign_order and returns how many orders were routed; OFF returns 0. Manager only.
create or replace function set_away_auto_assign(p_on boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_pid    uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_n      integer := 0;
  r        record;
begin
  if current_app_role() <> 'manager' then raise exception 'NOT_MANAGER'; end if;
  update profiles set away_auto_assign = p_on where id = v_pid;
  if not p_on then return 0; end if;
  for r in select id from orders
            where tenant_id = v_tenant and assignee_id is null and state in ('new', 'confirmed')
  loop
    if auto_assign_order(r.id) is not null then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;
revoke execute on function set_away_auto_assign(boolean) from public;
grant  execute on function set_away_auto_assign(boolean) to authenticated;

-- The calling manager's current away flag (self-read; profiles' manager-visible rows make a plain filtered
-- select ambiguous, so read it through the JWT-derived profile id).
create or replace function my_away_auto_assign()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select away_auto_assign from profiles where id = current_profile_id()), false);
$$;
revoke execute on function my_away_auto_assign() from public;
grant  execute on function my_away_auto_assign() to authenticated;
