-- Custom quotes — the path for packages that carry a price of 0 and a priceLabel of 'Consult'.
--
-- Until now those packages were a hole: the dashboard passed value 0 straight to create_order and the
-- customer got a real, free order (fixed in ced9dc5 by refusing them outright). Refusing is honest but
-- it's a dead end. This is the actual product: the customer asks, a specialist prices the job, the
-- customer gets a link and pays THAT amount.
--
-- MONEY-BLINDNESS. Managers deliberately cannot see money: no pricing.view, no finance.view, and
-- orders_mgr strips `value`. Quoting is pricing, so this is a NARROW, DELIBERATE exception agreed with
-- the product owner: a manager may name a price on a quote, and nothing else about money changes. They
-- still cannot see a customer's wallet, LTV, revenue, or any other order's value — including the value
-- of the order their own quote becomes.
--
-- SCOPE. managerScope normally limits a manager to their pod, but a pod is derived from who works a
-- customer's orders — and a customer asking for a custom job usually has none yet, so their request
-- would belong to nobody and be invisible. The quote queue is therefore tenant-wide: quoting is sales,
-- not ops. Pod-scoping resumes the moment an accepted quote becomes an order.
create table quotes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  -- The URL segment. NOT a capability: /quote/<token> still requires the owning customer to be signed
  -- in (see the RLS below). Accepting debits a wallet, so a leaked link must never be enough to spend
  -- someone else's money — the token says WHICH quote, auth says WHO.
  token        text not null unique,
  service      text not null,
  package_id   text not null,
  package_name text not null,
  -- captured at request time so accept_quote can mint a well-formed order code without trusting input
  code_prefix  text not null,
  brief        jsonb not null default '[]'::jsonb,
  ask          text,                                   -- what the customer told us
  amount       numeric(12,2) check (amount > 0),       -- null until a specialist prices it
  quote_note   text,                                   -- the specialist's message to the customer
  status       text not null default 'requested'
               check (status in ('requested', 'quoted', 'accepted', 'declined', 'expired')),
  quoted_by    uuid references profiles(id),
  quoted_at    timestamptz,
  expires_at   timestamptz,
  order_id     uuid references orders(id),
  created_at   timestamptz not null default now()
);
create index quotes_tenant_idx   on quotes (tenant_id, created_at desc);
create index quotes_customer_idx on quotes (customer_id, created_at desc);

alter table quotes enable row level security;
-- RLS ≠ GRANT: a policy alone renders nothing. Both are needed.
grant select on quotes to authenticated;

-- admin: the whole tenant
create policy quotes_admin on quotes
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

-- manager: the shared quote queue (tenant-wide, per the scope note above)
create policy quotes_manager on quotes
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'manager');

-- the owning customer, and only once there's something to look at. A 'requested' row is our internal
-- work-in-progress; the customer sees their quote when it has actually been priced.
create policy quotes_customer on quotes
  for select to authenticated
  using (
    current_app_role() = 'customer'
    and status <> 'requested'
    and customer_id in (select id from customers where user_id = current_profile_id())
  );

-- ── request_quote: the customer asks. NO money moves. ────────────────────────────────────────────────
-- service_role only: the order action calls it after resolving the catalog server-side, exactly like
-- create_order. The customer never picks their own service/package strings out of a request body.
create or replace function request_quote(
  p_tenant uuid, p_customer uuid, p_service text, p_package_id text, p_package_name text,
  p_code_prefix text, p_brief jsonb default '[]'::jsonb, p_ask text default null
) returns quotes
language plpgsql security definer
set search_path = public
as $$
declare
  v_quote quotes;
begin
  insert into quotes(tenant_id, customer_id, token, service, package_id, package_name, code_prefix, brief, ask)
       values (
         p_tenant, p_customer,
         -- 244 bits of randomness. gen_random_uuid() is already used tenant-wide; two of them beat any
         -- guessing attempt on a link, and auth is the real gate anyway.
         replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
         p_service, p_package_id, p_package_name, p_code_prefix, coalesce(p_brief, '[]'::jsonb), p_ask
       )
    returning * into v_quote;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (p_tenant, null, 'quote.requested', 'customer', p_customer,
               jsonb_build_object('service', p_service, 'package', p_package_name));
  return v_quote;
end $$;
revoke execute on function request_quote(uuid, uuid, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant  execute on function request_quote(uuid, uuid, text, text, text, text, jsonb, text) to service_role;

-- ── create_quote: a specialist prices it. MANAGER (or admin) only. ──────────────────────────────────
create or replace function create_quote(p_quote uuid, p_amount numeric, p_note text default null, p_valid_days int default 14)
returns quotes
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor  uuid := current_profile_id();
  v_tenant uuid := current_tenant_id();
  v_role   text := current_app_role();
  v_quote  quotes;
begin
  -- authz derived from the JWT, never from an argument (the lesson of 20260629130000).
  if v_role not in ('manager', 'admin') then raise exception 'NOT_AUTHORIZED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 90 then raise exception 'INVALID_VALIDITY'; end if;

  select * into v_quote from quotes where id = p_quote and tenant_id = v_tenant for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  -- Re-quoting an open quote is fine (the customer haggles). Re-pricing one they already acted on is
  -- not: it would move the number under a decision they already made.
  if v_quote.status not in ('requested', 'quoted') then raise exception 'QUOTE_CLOSED'; end if;

  update quotes
     set amount = p_amount, quote_note = p_note, status = 'quoted',
         quoted_by = v_actor, quoted_at = now(),
         expires_at = now() + make_interval(days => p_valid_days)
   where id = p_quote
   returning * into v_quote;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_tenant, v_actor, 'quote.priced', 'customer', v_quote.customer_id,
               jsonb_build_object('amount', p_amount, 'service', v_quote.service, 'valid_days', p_valid_days));
  return v_quote;
end $$;
revoke execute on function create_quote(uuid, numeric, text, int) from public, anon;
grant  execute on function create_quote(uuid, numeric, text, int) to authenticated;

-- ── accept_quote: the customer pays the quoted amount and the order is born. ────────────────────────
-- Callable by `authenticated` and gated on ownership + claims. It takes the TOKEN (that's what the
-- customer has) but ownership is what authorises — a leaked link is not a wallet.
create or replace function accept_quote(p_token text) returns orders
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid := current_profile_id();
  v_quote quotes;
  v_order orders;
  v_code  text;
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_quote from quotes where token = p_token for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if not exists (select 1 from customers where id = v_quote.customer_id and user_id = v_actor)
    then raise exception 'NOT_YOUR_QUOTE'; end if;
  if v_quote.status <> 'quoted' then raise exception 'QUOTE_NOT_OPEN'; end if;
  if v_quote.expires_at is not null and v_quote.expires_at < now() then
    update quotes set status = 'expired' where id = v_quote.id;
    raise exception 'QUOTE_EXPIRED';
  end if;

  -- the code is minted here from the prefix captured at request time — never from client input
  v_code := v_quote.code_prefix || '-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0');

  -- same money path as create_order: debit first, and let the balance guard reject an underfunded wallet
  update customer_balances
     set balance = balance - v_quote.amount, updated_at = now()
   where customer_id = v_quote.customer_id and tenant_id = v_quote.tenant_id and balance >= v_quote.amount;
  if not found then raise exception 'INSUFFICIENT_CREDIT'; end if;

  insert into orders(tenant_id, code, customer_id, service, value, state)
       values (v_quote.tenant_id, v_code, v_quote.customer_id, v_quote.service, v_quote.amount, 'new')
    returning * into v_order;
  insert into credit_ledger(tenant_id, customer_id, amount, kind, order_id)
       values (v_quote.tenant_id, v_quote.customer_id, -v_quote.amount, 'debit', v_order.id);

  update quotes set status = 'accepted', order_id = v_order.id where id = v_quote.id;

  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id, meta)
       values (v_quote.tenant_id, v_actor, 'quote.accepted', 'order', v_order.id,
               jsonb_build_object('amount', v_quote.amount, 'quote', v_quote.id));
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_quote.tenant_id, v_actor, 'order.created', 'order', v_order.id);
  return v_order;
end $$;
revoke execute on function accept_quote(text) from public, anon;
grant  execute on function accept_quote(text) to authenticated;

-- ── decline_quote ───────────────────────────────────────────────────────────────────────────────────
create or replace function decline_quote(p_token text) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid := current_profile_id();
  v_quote quotes;
begin
  if current_app_role() <> 'customer' then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_quote from quotes where token = p_token for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if not exists (select 1 from customers where id = v_quote.customer_id and user_id = v_actor)
    then raise exception 'NOT_YOUR_QUOTE'; end if;
  if v_quote.status <> 'quoted' then raise exception 'QUOTE_NOT_OPEN'; end if;

  update quotes set status = 'declined' where id = v_quote.id;
  insert into audit_log(tenant_id, actor_id, action, entity_type, entity_id)
       values (v_quote.tenant_id, v_actor, 'quote.declined', 'customer', v_quote.customer_id);
end $$;
revoke execute on function decline_quote(text) from public, anon;
grant  execute on function decline_quote(text) to authenticated;
