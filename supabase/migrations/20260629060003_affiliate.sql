-- E0b money increment 3: affiliate (KOL) subsystem — the 3rd money system (ADR K11).
-- affiliates + referrals (structural) + affiliate_commission/commission_ledger/affiliate_payouts (money).
-- MONEY-BLIND to manager/staff/customer (no policy → 0). An affiliate sees ONLY their own data.

create type affiliate_tier   as enum ('bronze', 'silver', 'gold', 'platinum');
create type affiliate_status as enum ('pending', 'active', 'churned');

create table affiliates (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid references profiles(id),                 -- the affiliate's portal account (null until claimed)
  code       text not null,                                -- referral code
  tier       affiliate_tier not null default 'bronze',
  status     affiliate_status not null default 'pending',
  joined_at  date,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index affiliates_tenant_idx on affiliates (tenant_id);
create index affiliates_user_idx   on affiliates (user_id);

create table affiliate_referrals (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  customer_id  uuid references customers(id) on delete set null,
  volume       numeric(12,2) not null default 0,           -- attributed order volume
  status       text not null default 'active' check (status in ('active', 'churned')),
  created_at   timestamptz not null default now()
);
create index affiliate_referrals_tenant_idx    on affiliate_referrals (tenant_id);
create index affiliate_referrals_affiliate_idx on affiliate_referrals (affiliate_id);

create table affiliate_commission (
  affiliate_id uuid primary key references affiliates(id) on delete cascade,  -- 1:1 balance
  tenant_id    uuid not null references tenants(id) on delete cascade,
  balance      numeric(12,2) not null default 0,
  updated_at   timestamptz not null default now()
);
create index affiliate_commission_tenant_idx on affiliate_commission (tenant_id);

create table commission_ledger (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount       numeric(12,2) not null,                     -- + commission, - payout
  kind         text not null check (kind in ('commission', 'payout', 'adjustment')),
  referral_id  uuid references affiliate_referrals(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index commission_ledger_tenant_idx    on commission_ledger (tenant_id);
create index commission_ledger_affiliate_idx on commission_ledger (affiliate_id);
create index commission_ledger_created_idx   on commission_ledger (tenant_id, created_at);

create table affiliate_payouts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount       numeric(12,2) not null,
  status       text not null default 'requested' check (status in ('requested', 'approved', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz
);
create index affiliate_payouts_tenant_idx    on affiliate_payouts (tenant_id);
create index affiliate_payouts_affiliate_idx on affiliate_payouts (affiliate_id);

alter table affiliates           enable row level security;
alter table affiliate_referrals  enable row level security;
alter table affiliate_commission enable row level security;
alter table commission_ledger    enable row level security;
alter table affiliate_payouts    enable row level security;
grant select on affiliates, affiliate_referrals, affiliate_commission, commission_ledger, affiliate_payouts to authenticated;

-- affiliates: admin (all tenant) + the affiliate themselves (own record).
create policy affiliates_admin on affiliates
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy affiliates_own on affiliates
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'affiliate' and user_id = current_profile_id());

-- referrals + money tables: admin (all) + affiliate-own (joined through affiliates.user_id).
-- NO manager/staff/customer policy → money-blind, 0 rows.
create policy affiliate_referrals_admin on affiliate_referrals
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy affiliate_referrals_own on affiliate_referrals
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'affiliate'
    and exists (select 1 from affiliates a where a.id = affiliate_referrals.affiliate_id and a.user_id = current_profile_id()));

create policy affiliate_commission_admin on affiliate_commission
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy affiliate_commission_own on affiliate_commission
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'affiliate'
    and exists (select 1 from affiliates a where a.id = affiliate_commission.affiliate_id and a.user_id = current_profile_id()));

create policy commission_ledger_admin on commission_ledger
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy commission_ledger_own on commission_ledger
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'affiliate'
    and exists (select 1 from affiliates a where a.id = commission_ledger.affiliate_id and a.user_id = current_profile_id()));

create policy affiliate_payouts_admin on affiliate_payouts
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy affiliate_payouts_own on affiliate_payouts
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'affiliate'
    and exists (select 1 from affiliates a where a.id = affiliate_payouts.affiliate_id and a.user_id = current_profile_id()));
