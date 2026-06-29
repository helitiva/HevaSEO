-- Audit log RLS: admin-only — non-admins (staff, customer) and cross-tenant admins see 0 rows.
begin;
select plan(6);

-- structure
select has_table('audit_log', 'audit_log table exists');
select ok((select relrowsecurity from pg_class where relname = 'audit_log'), 'RLS on audit_log');

-- seed tenants (as superuser)
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');

-- seed audit rows: three in tenant A, one in tenant B
insert into audit_log(id, tenant_id, action, entity_type) values
  ('aaaa0000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'order.created', 'order'),
  ('aaaa0000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'order.updated', 'order'),
  ('aaaa0000-0000-0000-0000-0000000000a3', '11111111-1111-1111-1111-111111111111', 'ticket.closed', 'ticket'),
  ('bbbb0000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'order.created', 'order');

set local role authenticated;

-- admin sees all tenant-A rows
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from audit_log)::int, 3, 'admin sees all tenant-A audit rows');

-- staff sees nothing
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"cccccccc-cccc-cccc-cccc-cccccccccccc"}';
select is((select count(*) from audit_log)::int, 0, 'staff sees 0 audit rows');

-- customer sees nothing
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"dddddddd-dddd-dddd-dddd-dddddddddddd"}';
select is((select count(*) from audit_log)::int, 0, 'customer sees 0 audit rows');

-- cross-tenant admin sees nothing of tenant A
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from audit_log)::int, 1, 'cross-tenant admin sees only their own tenant rows');

reset role;
select * from finish();
rollback;
