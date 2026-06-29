-- E0d increment 3 (last foundation piece): post earnings to the worker + affiliate wallets, with
-- the manager-override cascade. Same ledger pattern (ADR K11): balance += amount + ledger entry,
-- atomic, audited. SECURITY DEFINER — only these functions post commission.

-- Pod link: which manager owns this staff (drives the manager's % override).
alter table staff_details add column manager_id uuid references profiles(id);
create index staff_details_manager_idx on staff_details (manager_id);

-- Manager override rates (% of pod gig pay / commission). Single source, mirrors adminMock.
create or replace function manager_gig_pct()  returns numeric language sql immutable as $$ select 0.10 $$;
create or replace function manager_comm_pct() returns numeric language sql immutable as $$ select 0.15 $$;

-- post_staff_pay: credit a staffer's wallet with their commission + gig for an order, then cascade
-- the manager override (gigPct%·gig + commPct%·commission) to that staff's pod manager (if any).
create or replace function post_staff_pay(
  p_order uuid, p_staff uuid, p_commission numeric, p_gig numeric, p_actor uuid
) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_tenant uuid; v_total numeric; v_mgr uuid; v_override numeric;
begin
  select tenant_id into v_tenant from orders where id = p_order;
  if v_tenant is null then raise exception 'ORDER_NOT_FOUND'; end if;
  v_total := coalesce(p_commission, 0) + coalesce(p_gig, 0);
  if v_total > 0 then
    insert into staff_wallet(staff_id, tenant_id, balance) values (p_staff, v_tenant, v_total)
      on conflict (staff_id) do update set balance = staff_wallet.balance + v_total, updated_at = now();
    insert into wallet_ledger(tenant_id, staff_id, amount, kind, order_id, note)
      values (v_tenant, p_staff, v_total, 'commission', p_order, 'commission + gig');
  end if;
  -- cascade: the staff's pod manager earns an override on this staff's gig + commission
  select manager_id into v_mgr from staff_details where profile_id = p_staff;
  if v_mgr is not null then
    v_override := round(coalesce(p_gig, 0) * manager_gig_pct() + coalesce(p_commission, 0) * manager_comm_pct(), 2);
    if v_override > 0 then
      insert into staff_wallet(staff_id, tenant_id, balance) values (v_mgr, v_tenant, v_override)
        on conflict (staff_id) do update set balance = staff_wallet.balance + v_override, updated_at = now();
      insert into wallet_ledger(tenant_id, staff_id, amount, kind, order_id, note)
        values (v_tenant, v_mgr, v_override, 'commission', p_order, 'pod override');
    end if;
  end if;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, p_actor, 'commission.posted', 'order', p_order);
end $$;

-- post_affiliate_commission: credit a referred order's commission to the affiliate's wallet.
create or replace function post_affiliate_commission(
  p_order uuid, p_affiliate uuid, p_amount numeric, p_actor uuid
) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_tenant uuid;
begin
  if p_amount <= 0 then return; end if;
  select tenant_id into v_tenant from orders where id = p_order;
  if v_tenant is null then raise exception 'ORDER_NOT_FOUND'; end if;
  insert into affiliate_commission(affiliate_id, tenant_id, balance) values (p_affiliate, v_tenant, p_amount)
    on conflict (affiliate_id) do update set balance = affiliate_commission.balance + p_amount, updated_at = now();
  insert into commission_ledger(tenant_id, affiliate_id, amount, kind)
       values (v_tenant, p_affiliate, p_amount, 'commission');
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_tenant, p_actor, 'affiliate.commission.posted', 'order', p_order);
end $$;
