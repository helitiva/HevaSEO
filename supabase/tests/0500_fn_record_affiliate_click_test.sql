-- Lane E inc-E16: record_affiliate_click — anon-callable, increments counter + logs a click; silent on miss.
begin;
select plan(6);

select has_table('affiliate_clicks', 'affiliate_clicks table exists');
select ok(has_function_privilege('anon', 'record_affiliate_click(text)', 'execute'), 'anon CAN record a click');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', '11111111-1111-1111-1111-111111111111', 'aff@a', 'Aff', 'affiliate');
insert into affiliates(id, tenant_id, user_id, code, tier, status, clicks) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000a0f1', 'AFF1', 'bronze', 'active', 0);

set local role anon;
-- click by code (case-insensitive), then an unknown code (no-op)
select record_affiliate_click('aff1');
select record_affiliate_click('AFF1');
select record_affiliate_click('NOPE');

reset role;
select is((select clicks from affiliates where id = 'eeeeeeee-0000-0000-0000-0000000000f1'), 2, 'counter incremented twice (case-insensitive)');
select is((select count(*) from affiliate_clicks where affiliate_id = 'eeeeeeee-0000-0000-0000-0000000000f1')::int, 2, 'two click rows logged');
select is((select count(*) from affiliate_clicks)::int, 2, 'unknown code recorded nothing (silent)');
select ok(not exists (select 1 from affiliates where code = 'NOPE'), 'unknown code never existed');

select * from finish();
rollback;
