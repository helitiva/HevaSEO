-- Compensation config — the piece that never existed. A staffer's salary lived in adminMock
-- (SALARY_BY_ROLE) plus a localStorage "override" store, so "set a salary" persisted nowhere, applied to
-- nobody, and payroll could not be computed from real work. This is the real, auditable home for it.
--
-- Commission is a % of the order value that person EARNED in the period, on the same ASC 606 basis the
-- revenue book uses: an order counts on the day it was DELIVERED, never when it was merely placed.
--   · staff   → orders they were the assignee of
--   · manager → orders delivered by their pod
create table if not exists staff_comp (
  profile_id     uuid primary key references profiles(id) on delete cascade,
  tenant_id      uuid not null references tenants(id) on delete cascade,
  base_salary    numeric(12,2) not null default 0 check (base_salary >= 0),   -- fixed, per month
  commission_pct numeric(5,2)  not null default 0 check (commission_pct >= 0 and commission_pct <= 100),
  updated_at     timestamptz not null default now()
);

alter table staff_comp enable row level security;

-- money config: admin reads/manages; a person may read their own line (their finance page shows their comp)
create policy staff_comp_admin_read on staff_comp for select to authenticated
  using (current_app_role() = 'admin' and tenant_id = current_tenant_id());
create policy staff_comp_self_read on staff_comp for select to authenticated
  using (profile_id = current_profile_id());

-- No direct write policy: all writes go through the fn below, so the admin check + validation can't be
-- bypassed by a crafted PostgREST call.
revoke insert, update, delete on staff_comp from authenticated;

/** Admin sets one person's compensation. Claims-derived; the target must be staff or manager in-tenant. */
create or replace function set_staff_comp(p_profile uuid, p_base numeric, p_pct numeric)
returns staff_comp
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := current_tenant_id();
  v_row    staff_comp;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if p_base is null or p_base < 0 then raise exception 'BAD_SALARY'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then raise exception 'BAD_RATE'; end if;
  if not exists (
    select 1 from profiles where id = p_profile and tenant_id = v_tenant and role in ('staff', 'manager')
  ) then raise exception 'NOT_STAFF_OR_MANAGER'; end if;

  insert into staff_comp (profile_id, tenant_id, base_salary, commission_pct, updated_at)
       values (p_profile, v_tenant, p_base, p_pct, now())
  on conflict (profile_id) do update
     set base_salary = excluded.base_salary, commission_pct = excluded.commission_pct, updated_at = now()
  returning * into v_row;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_tenant, current_profile_id(), 'staff.comp_set', 'staff', p_profile,
               jsonb_build_object('base_salary', p_base, 'commission_pct', p_pct));
  return v_row;
end $$;
revoke execute on function set_staff_comp(uuid, numeric, numeric) from public;
grant  execute on function set_staff_comp(uuid, numeric, numeric) to authenticated;
