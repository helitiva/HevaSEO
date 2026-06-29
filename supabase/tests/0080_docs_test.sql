-- Docs RLS: audience distribution + staff skill-gating via current_skills().
begin;
select plan(7);

-- structure
select has_table('docs', 'docs table exists');
select ok((select relrowsecurity from pg_class where relname = 'docs'), 'RLS on docs');

-- seed tenants (as superuser)
insert into tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'B');

-- seed docs in tenant A: one per audience, plus a skill-gated staff doc (4 total)
insert into docs(id, tenant_id, title, audiences, required_skills) values
  ('dddd0000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Customer guide', '{customer}', '{}'),
  ('dddd0000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'Staff handbook', '{staff}', '{}'),
  ('dddd0000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'Keyword playbook', '{staff}', '{keyword}'),
  ('dddd0000-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'Manager memo', '{manager}', '{}');

set local role authenticated;

-- admin sees all tenant docs
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin"}';
select is((select count(*) from docs)::int, 4, 'admin sees all docs');

-- customer sees only customer-audience docs
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select is((select count(*) from docs)::int, 1, 'customer sees only customer-audience docs');

-- staff WITHOUT the keyword skill sees only the ungated staff doc (not the gated one)
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","skills":[]}';
select is((select count(*) from docs)::int, 1, 'staff without skill sees only ungated staff doc');

-- staff WITH the keyword skill sees both staff docs
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","skills":["keyword"]}';
select is((select count(*) from docs)::int, 2, 'staff with keyword skill sees both staff docs');

-- cross-tenant admin sees nothing
set local request.jwt.claims = '{"tenant_id":"22222222-2222-2222-2222-222222222222","app_role":"admin"}';
select is((select count(*) from docs)::int, 0, 'cross-tenant admin sees 0');

reset role;
select * from finish();
rollback;
