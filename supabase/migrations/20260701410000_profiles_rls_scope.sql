-- SECURITY (HIGH) — scope profiles reads. Finding (review 2026-07-01): the only SELECT policy on
-- profiles was `profiles_same_tenant USING (tenant_id = current_tenant_id())`, so ANY authenticated
-- user could read EVERY profile in the tenant. HevaSEO is a single agency tenant holding all
-- customers/staff/managers/admins → a logged-in customer could enumerate the whole user base
-- (emails/names/roles) + org chart straight from the browser anon client. Proven: a customer read all
-- 10 seeded profiles across 5 roles.
--
-- New model:
--   • internal roles (admin/manager/staff) keep same-tenant read — their surfaces legitimately embed
--     many profiles (order-thread authors, pod staff, deliverable submitters); they are vetted staff.
--   • external roles (customer/affiliate) get their OWN row only, plus — for customers — the profiles
--     CONNECTED to their own orders (the assigned staffer + anyone who posted a message on the order),
--     so thread-author and assignee names still resolve while enumeration is closed.
-- Admin-JWT server readers (staff roster, broadcast analytics) are unaffected (admin still reads all).

drop policy if exists profiles_same_tenant on profiles;

-- internal roles: same-tenant read (unchanged behavior)
create policy profiles_internal_read on profiles
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() in ('admin', 'manager', 'staff'));

-- everyone: own row (covers getServerSession's user_id lookup and the profile_id claim)
create policy profiles_self_read on profiles
  for select to authenticated
  using (tenant_id = current_tenant_id() and (id = current_profile_id() or user_id = auth.uid()));

-- customer: only profiles tied to their own orders — the assigned staffer + message authors — so the
-- portal's assignee/thread-author names resolve without exposing the rest of the tenant.
create policy profiles_customer_connected_read on profiles
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and id in (
      select o.assignee_id
        from orders o join customers c on c.id = o.customer_id
       where c.user_id = current_profile_id() and o.assignee_id is not null
      union
      select m.author_id
        from order_messages m
        join orders o on o.id = m.order_id
        join customers c on c.id = o.customer_id
       where c.user_id = current_profile_id()
    )
  );
