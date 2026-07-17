-- Custom quotes (20260717150000) — the path for 'Consult' / 'from $X' plans, which must never become a
-- free order. CRITICAL: a quote link is not a wallet. Accepting one debits real credit, so ownership —
-- not possession of the token — is what authorises it.
begin;
select plan(16);

select has_function('request_quote', 'request_quote() exists');
select has_function('create_quote', 'create_quote() exists');
select has_function('accept_quote', 'accept_quote() exists');

-- request_quote is service-role only: the order action resolves the catalog server-side and calls it,
-- exactly like create_order. A client must never name its own service/package/price.
select ok(not has_function_privilege('authenticated', 'request_quote(uuid,uuid,text,text,text,text,jsonb,text)', 'execute'),
          'CRITICAL: authenticated CANNOT execute request_quote');
select ok(not has_function_privilege('anon', 'create_quote(uuid,numeric,text,int)', 'execute'), 'anon CANNOT price a quote');
select ok(not has_function_privilege('anon', 'accept_quote(text)', 'execute'), 'anon CANNOT accept a quote');

insert into tenants(id, name) values ('11111111-1111-1111-1111-111111111111', 'A');
insert into profiles(id, tenant_id, email, name, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000b0a1', '11111111-1111-1111-1111-111111111111', 'mgr@a',  'Mgr',  'manager'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000b0a2', '11111111-1111-1111-1111-111111111111', 'stf@a',  'Stf',  'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000b0c1', '11111111-1111-1111-1111-111111111111', 'cus@a',  'Cus',  'customer'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000b0c2', '11111111-1111-1111-1111-111111111111', 'cus2@a', 'Cus2', 'customer');
insert into customers(id, tenant_id, user_id, name, company, email) values
  ('cccccccc-cccc-cccc-cccc-00000000c001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000b0c1', 'Cus',  'Acme',  'cus@a'),
  ('cccccccc-cccc-cccc-cccc-00000000c002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-00000000b0c2', 'Cus2', 'Other', 'cus2@a');
insert into customer_balances(customer_id, tenant_id, balance) values
  ('cccccccc-cccc-cccc-cccc-00000000c001', '11111111-1111-1111-1111-111111111111', 500),
  ('cccccccc-cccc-cccc-cccc-00000000c002', '11111111-1111-1111-1111-111111111111', 500);

-- the customer asks (service role, as the order action does). NO money moves.
select request_quote('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-00000000c001',
                     'Optimization', 'ultra', 'Ultra', 'OP', '[]'::jsonb, 'big site');
select is((select balance from customer_balances where customer_id = 'cccccccc-cccc-cccc-cccc-00000000c001')::numeric,
          500::numeric, 'CRITICAL: asking for a quote charges nothing');
select is((select count(*) from orders where tenant_id = '11111111-1111-1111-1111-111111111111')::int, 0, 'CRITICAL: asking for a quote creates no order');

-- Hold the token in a temp table (temp tables aren't RLS-scoped) BEFORE dropping privilege. This is
-- the realistic threat: the link arrives in a forwarded email, not from a query. Reading it back as the
-- wrong customer would only prove RLS hides the row — true, but not the guard we need on accept_quote.
create temp table tok as select id, token from quotes where tenant_id = '11111111-1111-1111-1111-111111111111';
grant select on tok to authenticated;  -- the harness switches role below; the temp table must survive it

set local role authenticated;

-- staff may not price
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"staff","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000b0a2"}';
select throws_ok($$ select create_quote((select id from tok limit 1), 200, 'x', 14) $$, 'NOT_AUTHORIZED',
                 'staff cannot price a quote');

-- manager prices it — the narrow, deliberate exception to manager money-blindness
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"manager","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000b0a1"}';
select throws_ok($$ select create_quote((select id from tok limit 1), 0, 'x', 14) $$, 'INVALID_AMOUNT',
                 'a quote cannot be priced at 0');
select create_quote((select id from tok limit 1), 200, 'deep pass', 14);
select is((select status from quotes where id = (select id from tok limit 1)), 'quoted', 'manager pricing marks it quoted');

-- CRITICAL: another customer holding the link cannot spend their way into someone else's job
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000b0c2"}';
select throws_ok($$ select accept_quote((select token from tok limit 1)) $$, 'NOT_YOUR_QUOTE',
                 'CRITICAL: a leaked quote link is not a wallet — ownership authorises, not the token');
select is((select balance from customer_balances where customer_id = 'cccccccc-cccc-cccc-cccc-00000000c002')::numeric,
          500::numeric, 'the wrong customer was not charged');

-- the owner accepts → debited exactly the quoted amount, order created
set local request.jwt.claims = '{"tenant_id":"11111111-1111-1111-1111-111111111111","app_role":"customer","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-00000000b0c1"}';
select accept_quote((select token from tok limit 1));
select is((select balance from customer_balances where customer_id = 'cccccccc-cccc-cccc-cccc-00000000c001')::numeric,
          300::numeric, 'accepting debits exactly the quoted amount');
select is((select value from orders where tenant_id = '11111111-1111-1111-1111-111111111111' limit 1)::numeric, 200::numeric, 'the order carries the quoted amount');

-- accepting twice must not create a second order or a second debit
select throws_ok($$ select accept_quote((select token from tok limit 1)) $$, 'QUOTE_NOT_OPEN',
                 'CRITICAL: a quote cannot be accepted twice');

select * from finish();
rollback;
