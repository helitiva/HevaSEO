-- Lane E inc-E5: set_affiliate_status — admin approve/suspend/reactivate (suspended→churned).
begin;
select plan(6);

select has_function('set_affiliate_status', 'set_affiliate_status() exists');
select ok(not has_function_privilege('anon', 'set_affiliate_status(uuid,text)', 'execute'), 'anon CANNOT set status');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');
insert into affiliates(id, tenant_id, user_id, code, tier, status) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'pending');

set local role authenticated;

-- non-admin cannot change status
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';
select throws_ok($$ select set_affiliate_status('eeeeeeee-0000-0000-0000-0000000000f1', 'active') $$, 'NOT_ADMIN', 'affiliate cannot change its own status');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
-- approve (pending → active)
select set_affiliate_status('eeeeeeee-0000-0000-0000-0000000000f1', 'active');
select is((select status::text from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'active', 'approve → active');
-- suspend (UI 'suspended' → DB 'churned')
select set_affiliate_status('eeeeeeee-0000-0000-0000-0000000000f1', 'suspended');
select is((select status::text from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'churned', 'suspend → churned');
-- reactivate
select set_affiliate_status('eeeeeeee-0000-0000-0000-0000000000f1', 'active');
select is((select status::text from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 'active', 'reactivate → active');

reset role;
select * from finish();
rollback;
