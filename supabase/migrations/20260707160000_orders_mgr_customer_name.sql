-- Staff (and managers) read orders via orders_mgr, which exposed only customer_id — the customer NAME came
-- from a PostgREST embed on customers, which needs customers-RLS the staff role doesn't have, so a staffer's
-- task showed the client as "—". Add customer_name/company as columns of the (definer) view so money-blind
-- roles can see WHO the work is for — work context, not money (value is still omitted). Row visibility is
-- unchanged (same WHERE gate).
create or replace view orders_mgr as
  select
    o.id, o.tenant_id, o.code, o.customer_id, o.service, o.pkg,
    o.state, o.priority, o.source, o.assignee_id, o.deadline, o.created_at,
    c.name as customer_name, c.company as customer_company
    -- `value` deliberately omitted (column-level money strip)
  from orders o
  left join customers c on c.id = o.customer_id
  where o.tenant_id = current_tenant_id()
    and (
      (current_app_role() = 'manager' and (
        o.assignee_id in (select profile_id from staff_details where manager_id = current_profile_id())
        or o.assignee_id is null
      ))
      or (current_app_role() = 'staff' and o.assignee_id = current_profile_id())
    );

grant select on orders_mgr to authenticated;

comment on view orders_mgr is
  'Money-stripped order view for money-blind roles: omits orders.value, exposes customer_name/company. '
  'Manager = own pod (staff_details.manager_id) + unassigned; staff = own assigned. WHERE is the access gate '
  '(definer view). admin/customer use base orders.';
