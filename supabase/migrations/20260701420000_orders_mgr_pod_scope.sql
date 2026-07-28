-- SECURITY (MEDIUM) — pod-scope the manager branch of orders_mgr. The original view
-- (20260629060004_money_stripped_views) granted managers ALL tenant orders with an in-code note that
-- "pod-scoping refinement is a later increment". This aligns the money-blind view with the documented
-- pod model: a manager sees orders assigned to THEIR pod (staff whose staff_details.manager_id is the
-- manager) plus UNASSIGNED orders (any manager may see & route these — RLS.md §2.2). Staff branch is
-- unchanged (own assigned only). Columns are identical, so readers are unaffected; only row visibility
-- narrows. Still a definer view → its WHERE clause is the access gate; current_* read the invoker's JWT.
create or replace view orders_mgr as
  select
    id, tenant_id, code, customer_id, service, pkg,
    state, priority, source, assignee_id, deadline, created_at
    -- `value` deliberately omitted (column-level money strip)
  from orders
  where tenant_id = current_tenant_id()
    and (
      (current_app_role() = 'manager' and (
        assignee_id in (select profile_id from staff_details where manager_id = current_profile_id())
        or assignee_id is null
      ))
      or (current_app_role() = 'staff' and assignee_id = current_profile_id())
    );

grant select on orders_mgr to authenticated;

comment on view orders_mgr is
  'Money-stripped order view for money-blind roles: omits orders.value. Manager = own pod (staff_details.manager_id) + unassigned; staff = own assigned. WHERE is the access gate (definer view). admin/customer use base orders.';
