-- Managers could not see or reply to real customer support tickets. `tickets` and `ticket_messages`
-- had admin/customer/staff RLS policies but NO manager policy, and `ticket_participant` (the guard
-- behind post_ticket_message / set_ticket_status) excluded managers — so the manager Tickets page fell
-- back to mock data and any reply raised NOT_PARTICIPANT. Give managers tenant-scoped, money-blind
-- ticket access, consistent with orders_mgr (which already grants managers tenant-wide, value-stripped
-- order visibility). Tickets carry no money, so no masking is needed here.

-- ── read: a manager sees their tenant's tickets + their message threads ───────────
create policy tickets_manager_pod on tickets
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'manager');

create policy ticket_messages_manager_pod on ticket_messages
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'manager');

-- ── write: managers may reply + change status. ticket_participant gates both fns ──
create or replace function ticket_participant(p_ticket uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from tickets t
    where t.id = p_ticket and t.tenant_id = current_tenant_id() and (
      current_app_role() = 'admin'
      or current_app_role() = 'manager'
      or (current_app_role() = 'staff' and t.assignee_id = current_profile_id())
      or (current_app_role() = 'customer' and exists (
        select 1 from customers c where c.id = t.customer_id and c.user_id = current_profile_id()))
    )
  );
$$;
