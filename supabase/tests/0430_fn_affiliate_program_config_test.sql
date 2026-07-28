-- Lane E inc-E7: affiliate program config — admin upserts rules + tier definitions; RLS admin-only read.
begin;
select plan(10);

select has_table('affiliate_program_config', 'program_config table exists');
select has_table('affiliate_tier_config', 'tier_config table exists');
select has_function('upsert_affiliate_program_config', 'rules upsert exists');
select has_function('upsert_affiliate_tier_config', 'tiers upsert exists');
select ok(not has_function_privilege('anon', 'upsert_affiliate_program_config(text,text,int,int,numeric,boolean,boolean)', 'execute'), 'anon CANNOT upsert rules');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1', '11111111-1111-1111-1111-111111111111', 'admin@a', 'Adm', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');

set local role authenticated;

-- non-admin blocked
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"affiliate","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1"}';
select throws_ok($$ select upsert_affiliate_program_config('manual','window',30,7,100,false,false) $$, 'NOT_ADMIN', 'affiliate cannot upsert rules');
select throws_ok($$ select upsert_affiliate_tier_config('[{"tier":"gold","min_volume":1,"rate":0.2}]'::jsonb) $$, 'NOT_ADMIN', 'affiliate cannot upsert tiers');

set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"admin","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000a0a1"}';
-- upsert rules, then update (idempotent on tenant PK)
select upsert_affiliate_program_config('manual','window',30,7,100,false,false);
select is((select min_payout from affiliate_program_config where tenant_id='11111111-1111-1111-1111-111111111111'), 100::numeric, 'rules stored (min_payout=100)');
select upsert_affiliate_program_config('instant','lifetime',60,14,75,true,true);
select is((select approval_mode from affiliate_program_config where tenant_id='11111111-1111-1111-1111-111111111111'), 'instant', 'rules re-upsert updates same row');

-- upsert tiers (replace), then verify a rate
select upsert_affiliate_tier_config('[{"tier":"bronze","min_volume":0,"rate":0.10},{"tier":"gold","min_volume":25000,"rate":0.22}]'::jsonb);
select is((select rate from affiliate_tier_config where tenant_id='11111111-1111-1111-1111-111111111111' and tier='gold'), 0.22::numeric, 'gold tier rate stored');

reset role;
select * from finish();
rollback;
