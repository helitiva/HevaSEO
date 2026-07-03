-- allowed_transitions (order state-machine matrix) is fully locked to the API roles: RLS on + no direct
-- grants. Only the SECURITY DEFINER order fns (which bypass RLS as owner) read it. An API key can neither
-- read, forge, nor TRUNCATE the state machine.
begin;
select plan(4);

select is((select relrowsecurity from pg_class where relname = 'allowed_transitions'), true,
  'RLS is enabled on allowed_transitions');

set local role authenticated;
set local request.jwt.claims = '{"app_role":"customer","tenant_id":"11111111-1111-1111-1111-111111111111","profile_id":"aaaaaaaa-0000-0000-0000-000000000c11"}';

select throws_ok($$ select count(*) from allowed_transitions $$,
  '42501', NULL, 'authenticated cannot read the transition matrix directly');
select throws_ok($$ insert into allowed_transitions(from_state, to_state, by_role) values ('delivered', 'completed', 'customer') $$,
  '42501', NULL, 'authenticated cannot forge a new transition');
select throws_ok($$ truncate allowed_transitions $$,
  '42501', NULL, 'authenticated cannot TRUNCATE the state machine');

reset role;
select * from finish();
rollback;
