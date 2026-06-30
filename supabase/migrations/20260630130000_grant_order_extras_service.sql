-- Lane B inc-B3: the create-order-from-UI server action runs as service_role (the only role allowed
-- to call create_order) and then writes the order's brief + paid add-ons. service_role bypasses RLS
-- but still needs table privileges — grant INSERT on the two order side-tables. (orders/credit_ledger
-- are written only by the SECURITY DEFINER create_order, so they need no direct grant.)
grant insert on order_details, order_addons to service_role;
