-- Lane D inc-D5: staff penalties. MONEY (gác③). A penalty is applied by an admin (debits the worker's
-- wallet immediately, kind='penalty'), the worker may dispute it, and an admin may waive it (refunds the
-- wallet). Same ledger/refund pattern as payouts. Money-blind: admin (tenant) + the worker themselves
-- (staff OR manager, own row); customers see nothing.
create table staff_penalties (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  staff_id     uuid not null references profiles(id) on delete cascade,
  type         text not null check (type in ('revision', 'late', 'rating', 'manual')),
  amount       numeric(12,2) not null check (amount > 0),
  detail       text,
  status       text not null default 'applied' check (status in ('applied', 'disputed', 'waived')),
  dispute_note text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index staff_penalties_tenant_idx on staff_penalties (tenant_id);
create index staff_penalties_staff_idx  on staff_penalties (staff_id);

alter table staff_penalties enable row level security;
grant select on staff_penalties to authenticated;
create policy staff_penalties_admin on staff_penalties for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy staff_penalties_own on staff_penalties for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() in ('staff', 'manager') and staff_id = current_profile_id());

-- apply_penalty (admin): debit the worker's wallet + record the penalty. atomic.
create or replace function apply_penalty(p_staff uuid, p_amount numeric, p_type text, p_detail text default null)
returns staff_penalties
language plpgsql security definer set search_path = public
as $$
declare
  v_actor  uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_pen    staff_penalties;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  update staff_wallet set balance = balance - p_amount, updated_at = now()
   where staff_id = p_staff and tenant_id = v_tenant;
  if not found then raise exception 'NO_WALLET'; end if;
  insert into wallet_ledger(tenant_id, staff_id, amount, kind, note)
       values (v_tenant, p_staff, -p_amount, 'penalty', coalesce(p_detail, p_type));
  insert into staff_penalties(tenant_id, staff_id, type, amount, detail, status)
       values (v_tenant, p_staff, p_type, p_amount, p_detail, 'applied')
    returning * into v_pen;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'penalty.applied', 'staff', p_staff);
  return v_pen;
end $$;

-- dispute_penalty (the worker themselves): flag an applied penalty as disputed. No money change.
create or replace function dispute_penalty(p_id uuid, p_note text)
returns staff_penalties
language plpgsql security definer set search_path = public
as $$
declare v_staff uuid := current_profile_id(); v_tenant uuid := current_tenant_id(); v_pen staff_penalties;
begin
  if current_app_role() not in ('staff', 'manager') then raise exception 'NOT_WORKER'; end if;
  select * into v_pen from staff_penalties where id = p_id and tenant_id = v_tenant and staff_id = v_staff for update;
  if not found then raise exception 'PENALTY_NOT_FOUND'; end if;
  if v_pen.status <> 'applied' then raise exception 'NOT_DISPUTABLE'; end if;
  update staff_penalties set status = 'disputed', dispute_note = p_note where id = p_id returning * into v_pen;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_staff, 'penalty.disputed', 'staff', v_staff);
  return v_pen;
end $$;

-- waive_penalty (admin): waive an applied/disputed penalty AND refund the worker's wallet.
create or replace function waive_penalty(p_id uuid)
returns staff_penalties
language plpgsql security definer set search_path = public
as $$
declare v_actor uuid := current_profile_id(); v_tenant uuid := current_tenant_id(); v_pen staff_penalties;
begin
  if current_app_role() <> 'admin' then raise exception 'NOT_ADMIN'; end if;
  select * into v_pen from staff_penalties where id = p_id and tenant_id = v_tenant for update;
  if not found then raise exception 'PENALTY_NOT_FOUND'; end if;
  if v_pen.status = 'waived' then raise exception 'ALREADY_WAIVED'; end if;
  update staff_wallet set balance = balance + v_pen.amount, updated_at = now()
   where staff_id = v_pen.staff_id and tenant_id = v_tenant;
  insert into wallet_ledger(tenant_id, staff_id, amount, kind, note)
       values (v_tenant, v_pen.staff_id, v_pen.amount, 'adjustment', 'penalty waived — refund');
  update staff_penalties set status = 'waived', resolved_at = now() where id = p_id returning * into v_pen;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, v_actor, 'penalty.waived', 'staff', v_pen.staff_id);
  return v_pen;
end $$;

revoke execute on function apply_penalty(uuid, numeric, text, text) from public;
revoke execute on function dispute_penalty(uuid, text)              from public;
revoke execute on function waive_penalty(uuid)                      from public;
grant  execute on function apply_penalty(uuid, numeric, text, text) to authenticated;
grant  execute on function dispute_penalty(uuid, text)              to authenticated;
grant  execute on function waive_penalty(uuid)                      to authenticated;
