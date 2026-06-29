-- E0b money increment 1: customer credit subsystem (ADR K3/K11).
-- customer_balances = authoritative O(1) balance; credit_ledger = append-only audit trail.
-- MONEY IS HIDDEN from staff and managers (ADR §5 money-blind matrix): no policy for them → 0 rows.
-- The atomic debit/topup/refund FUNCTIONS (UPDATE...WHERE balance>=price) land in E0d.

create table customer_balances (
  customer_id uuid primary key references customers(id) on delete cascade,  -- 1:1 with customer
  tenant_id   uuid not null references tenants(id) on delete cascade,
  balance     numeric(12,2) not null default 0,
  updated_at  timestamptz not null default now()
);
create index customer_balances_tenant_idx on customer_balances (tenant_id);

create table credit_ledger (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  amount          numeric(12,2) not null,                       -- + topup/refund, - debit
  kind            text not null check (kind in ('topup', 'debit', 'refund')),
  order_id        uuid references orders(id),
  stripe_event_id text,
  created_at      timestamptz not null default now()
);
create index credit_ledger_tenant_idx   on credit_ledger (tenant_id);
create index credit_ledger_customer_idx on credit_ledger (customer_id);
-- schema-ready for monthly partition (ADR D17; partition operation deferred — C5)
create index credit_ledger_created_idx on credit_ledger (tenant_id, created_at);
-- Stripe webhook idempotency (ADR §7 chốt 3): a given Stripe event can post at most once.
create unique index credit_ledger_stripe_idx on credit_ledger (stripe_event_id) where stripe_event_id is not null;

alter table customer_balances enable row level security;
alter table credit_ledger     enable row level security;
grant select on customer_balances, credit_ledger to authenticated;

-- Visibility: admin (all tenant) + customer (own only). NO staff, NO manager policy →
-- they see 0 rows. This is the money-blind rule enforced at the DB (ADR §5).
create policy customer_balances_admin on customer_balances
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create policy customer_balances_own on customer_balances
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and exists (
      select 1 from customers c
      where c.id = customer_balances.customer_id
        and c.user_id = current_profile_id()
    )
  );

create policy credit_ledger_admin on credit_ledger
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');

create policy credit_ledger_own on credit_ledger
  for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and current_app_role() = 'customer'
    and exists (
      select 1 from customers c
      where c.id = credit_ledger.customer_id
        and c.user_id = current_profile_id()
    )
  );
