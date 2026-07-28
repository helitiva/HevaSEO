-- Lane E inc-E13: create_affiliate_partner — admin provisions a shadow affiliate (profile + affiliates).
begin;
select plan(10);

select has_function('create_affiliate_partner', 'create_affiliate_partner() exists');
select ok(not has_function_privilege('anon', 'create_affiliate_partner(text,text,text,text,text,text,text)', 'execute'), 'anon CANNOT create partner');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');

set local role authenticated;

-- non-admin blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';
select throws_ok($$ select create_affiliate_partner('New','new@x.com','NEWCODE','gold',null,null,null) $$, 'NOT_ADMIN', 'affiliate cannot create partner');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';

-- bad inputs
select throws_ok($$ select create_affiliate_partner('New','not-an-email','NEWCODE','gold',null,null,null) $$, 'BAD_EMAIL', 'bad email rejected');
select throws_ok($$ select create_affiliate_partner('New','new@x.com','xx','gold',null,null,null) $$, 'BAD_CODE', 'bad code rejected');

-- happy path: shadow profile + affiliate + wallet
select create_affiliate_partner('New Partner', 'new@x.com', 'newcode', 'gold', 'YouTube', 'SEO', '10k');
select is((select role::text from profiles where email = 'new@x.com' and user_id is null), 'affiliate', 'shadow affiliate profile created (user_id null)');
select is((select status::text from affiliates where code = 'NEWCODE'), 'active', 'affiliate row active, code uppercased');
select ok((select tier_pinned from affiliates where code = 'NEWCODE'), 'explicit tier is pinned');
select is((select balance from affiliate_commission ac join affiliates a on a.id = ac.affiliate_id where a.code = 'NEWCODE')::numeric, 0::numeric, 'commission wallet initialized at 0');

-- duplicate email → EMAIL_TAKEN (atomic: no orphan)
select throws_ok($$ select create_affiliate_partner('Dup','new@x.com','OTHERCODE','silver',null,null,null) $$, 'EMAIL_TAKEN', 'duplicate email rejected');

reset role;
select * from finish();
rollback;
