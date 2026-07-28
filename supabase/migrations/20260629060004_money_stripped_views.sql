-- E0b money increment 4: money-stripped view (ADR K9 / eng-review Finding 1).
-- RLS is ROW-level; it cannot hide the `value` COLUMN from a manager who may see the order row.
-- So money-blind roles (manager, staff) read orders through orders_mgr, which simply OMITS value.
--
-- This is a plain (definer) view owned by the migration role, so it bypasses orders' base RLS;
-- the view's own WHERE clause is therefore the authoritative access gate. current_app_role() /
-- current_tenant_id() / current_profile_id() still read the INVOKER's JWT claims inside the WHERE.
-- admin + customer keep using the base `orders` table (they are allowed to see value).

create view orders_mgr as
  select
    id, tenant_id, code, customer_id, service, pkg,
    state, priority, source, assignee_id, deadline, created_at
    -- NOTE: `value` is deliberately omitted — this is the column-level money strip.
  from orders
  where tenant_id = current_tenant_id()
    and (
      -- ops (manager) see tenant orders; pod-scoping refinement is a later increment.
      current_app_role() = 'manager'
      -- a staff member sees only the orders assigned to them.
      or (current_app_role() = 'staff' and assignee_id = current_profile_id())
    );

grant select on orders_mgr to authenticated;

comment on view orders_mgr is
  'Money-stripped order view for money-blind roles (manager, staff): omits orders.value. '
  'WHERE clause is the access gate (definer view bypasses base RLS). admin/customer use base orders.';
