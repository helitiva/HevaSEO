-- The low-risk tail of the untested SECURITY DEFINER fns: preferences, dismissals, view-tracking, and a
-- project re-file. No money moves through any of them, so this is a lean guard — existence + the authz
-- gate each one leans on — not exhaustive behaviour. Each gate fires on role or on not-found before it
-- touches a row, so no project/deliverable/broadcast fixtures are needed to trip it.
begin;
select plan(12);

select has_function('reassign_project_orders',  'reassign_project_orders() exists');
select has_function('edit_deliverable',         'edit_deliverable() exists');
select has_function('mark_deliverable_viewed',  'mark_deliverable_viewed() exists');
select has_function('set_notif_prefs',          'set_notif_prefs() exists');
select has_function('mark_broadcast_dismissed', 'mark_broadcast_dismissed() exists');
select ok(not has_function_privilege('anon', 'set_notif_prefs(jsonb)', 'execute'),          'anon cannot set notification prefs');
select ok(not has_function_privilege('anon', 'mark_broadcast_dismissed(uuid)', 'execute'),  'anon cannot dismiss a broadcast');

insert into tenants(id, name) values ('77777777-7777-7777-7777-777777777777', 'Misc');
insert into profiles(id, tenant_id, email, name, role) values
  ('77770000-0000-4000-8000-0000000000c1', '77777777-7777-7777-7777-777777777777', 'c@m', 'C', 'customer'),
  ('77770000-0000-4000-8000-0000000000f1', '77777777-7777-7777-7777-777777777777', 's@m', 'S', 'staff');

set local role authenticated;
-- the uuids below (…00ff / …00fe) match nothing — enough to trip the ownership / not-found guards

-- ── prefs / edits are role-gated ─────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"tenant_id":"77777777-7777-7777-7777-777777777777","app_role":"staff","profile_id":"77770000-0000-4000-8000-0000000000f1"}';
select throws_ok($$ select set_notif_prefs('{"email":false}'::jsonb) $$, 'NOT_CUSTOMER', 'only a customer sets their own notification prefs');

set local request.jwt.claims = '{"tenant_id":"77777777-7777-7777-7777-777777777777","app_role":"customer","profile_id":"77770000-0000-4000-8000-0000000000c1"}';
select throws_ok($$ select edit_deliverable('00000000-0000-4000-8000-0000000000ff'::uuid, 'x', '[]'::jsonb) $$, 'NOT_STAFF', 'only staff edit a deliverable');
select throws_ok($$ select reassign_project_orders('00000000-0000-4000-8000-0000000000ff'::uuid, '00000000-0000-4000-8000-0000000000fe'::uuid) $$, 'NOT_YOUR_PROJECT', 'a customer cannot re-file orders into/out of a project that isn''t theirs');
select throws_ok($$ select mark_broadcast_dismissed('00000000-0000-4000-8000-0000000000ff'::uuid) $$, 'NOT_A_RECIPIENT', 'only an addressed recipient can dismiss a broadcast');

-- ── mark_deliverable_viewed is a customer-only no-op for anyone else (returns, does not raise) ────────
set local request.jwt.claims = '{"tenant_id":"77777777-7777-7777-7777-777777777777","app_role":"staff","profile_id":"77770000-0000-4000-8000-0000000000f1"}';
select lives_ok($$ select mark_deliverable_viewed('00000000-0000-4000-8000-0000000000ff'::uuid) $$, 'a non-customer viewing is a silent no-op, not an error');

select * from finish();
rollback;
