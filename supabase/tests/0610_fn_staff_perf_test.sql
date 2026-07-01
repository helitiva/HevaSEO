-- inc-E32: staff_perf_all — computes quality / on_time / throughput from real deliverables + deadlines.
begin;
select plan(5);

select has_function('staff_perf_all', 'staff_perf_all() exists');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '11111111-1111-1111-1111-111111111111', 's1@a', 'S1', 'staff');
insert into customers(id, tenant_id, name, company, email, status) values
  ('cccccccc-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Acme', 'Acme', 'c@a', 'claimed');
-- two orders with deadlines; deliverables: 1 approved on-time, 1 approved late, 1 changes_requested, 1 unreviewed
insert into orders(id, tenant_id, customer_id, code, service, value, state, assignee_id, deadline) values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'O1', 'Keyword', 60, 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '2026-06-10T00:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a2'::uuid, '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000c1', 'O2', 'Keyword', 60, 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', '2026-06-10T00:00:00Z');
insert into deliverables(tenant_id, order_id, submitter_id, version, status, reviewed_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 1, 'approved', '2026-06-09T00:00:00Z'),  -- on time
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 1, 'approved', '2026-06-12T00:00:00Z'),  -- late
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 2, 'changes_requested', '2026-06-08T00:00:00Z'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051', 2, 'submitted', null);

set local role authenticated;
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';

-- quality = 2 approved / 3 reviewed = 67; on_time = 1 on-time / 2 approved = 50; throughput = 2 approved
select is((select quality    from staff_perf_all() where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051'), 67, 'quality = approved/reviewed = 67');
select is((select on_time    from staff_perf_all() where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051'), 50, 'on_time = on-time/approved = 50');
select is((select throughput from staff_perf_all() where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a051'), 2, 'throughput = approved count = 2');
select is((select count(*) from staff_perf_all())::int, 1, 'only submitters with deliverables appear');

reset role;
select * from finish();
rollback;
