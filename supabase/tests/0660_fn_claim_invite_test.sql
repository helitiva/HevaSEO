-- Guard for 20260701460000_fn_claim_invite: service-role-only; links an unclaimed shadow; NO_INVITE
-- when there is nothing to claim. This is the explicit privileged-invite link path (admin provisioning).
begin;
select plan(5);

select has_function('claim_invite', 'claim_invite() exists');
select ok(not has_function_privilege('authenticated', 'claim_invite(text,uuid)', 'execute'),
  'authenticated CANNOT execute claim_invite (service-role only)');
select ok(not has_function_privilege('anon', 'claim_invite(text,uuid)', 'execute'),
  'anon CANNOT execute claim_invite');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(tenant_id, email, name, role, status, user_id) values
  ('11111111-1111-1111-1111-111111111111', 'invitee@a.com', 'Invitee', 'staff', 'invited', null);

select claim_invite('invitee@a.com', '99999999-9999-4999-8999-999999999999');
select is(
  (select user_id from profiles where email = 'invitee@a.com'),
  '99999999-9999-4999-8999-999999999999'::uuid,
  'claim_invite links the unclaimed shadow to the auth user');

select throws_ok($$ select claim_invite('nobody@a.com', '99999999-9999-4999-8999-999999999999') $$,
  'NO_INVITE', 'claim_invite raises NO_INVITE when there is no unclaimed shadow');

select * from finish();
rollback;
