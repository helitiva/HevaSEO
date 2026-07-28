-- E0b money increment 2: staff wallet subsystem (ADR K11 — same ledger pattern, staff instance).
-- A staffer's commission wallet + append-only ledger + payout methods + payout requests.
-- MONEY-BLIND to managers and customers (no policy → 0 rows). Staff see ONLY their own.
-- Atomic credit/payout FUNCTIONS land in E0d.

create table staff_wallet (
  staff_id   uuid primary key references profiles(id) on delete cascade,  -- 1:1 with a staff profile
  tenant_id  uuid not null references tenants(id) on delete cascade,
  balance    numeric(12,2) not null default 0,                            -- pending commission
  updated_at timestamptz not null default now()
);
create index staff_wallet_tenant_idx on staff_wallet (tenant_id);

create table wallet_ledger (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references profiles(id) on delete cascade,
  amount     numeric(12,2) not null,                                       -- + commission/bonus, - penalty/payout
  kind       text not null check (kind in ('commission', 'bonus', 'penalty', 'payout', 'adjustment')),
  order_id   uuid references orders(id),
  note       text,
  created_at timestamptz not null default now()
);
create index wallet_ledger_tenant_idx  on wallet_ledger (tenant_id);
create index wallet_ledger_staff_idx    on wallet_ledger (staff_id);
create index wallet_ledger_created_idx  on wallet_ledger (tenant_id, created_at);

create table staff_payout_methods (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('bank', 'paypal', 'wise', 'crypto')),
  detail     text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index staff_payout_methods_tenant_idx on staff_payout_methods (tenant_id);
create index staff_payout_methods_staff_idx   on staff_payout_methods (staff_id);

create table payout_requests (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  staff_id     uuid not null references profiles(id) on delete cascade,
  amount       numeric(12,2) not null,
  method_id    uuid references staff_payout_methods(id) on delete set null,
  status       text not null default 'requested' check (status in ('requested', 'approved', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz
);
create index payout_requests_tenant_idx on payout_requests (tenant_id);
create index payout_requests_staff_idx   on payout_requests (staff_id);

alter table staff_wallet         enable row level security;
alter table wallet_ledger        enable row level security;
alter table staff_payout_methods enable row level security;
alter table payout_requests      enable row level security;
grant select on staff_wallet, wallet_ledger, staff_payout_methods, payout_requests to authenticated;

-- For each money table: admin (all tenant) + staff-own. NO manager/customer policy → 0 rows (money-blind).
create policy staff_wallet_admin on staff_wallet
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy staff_wallet_own on staff_wallet
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'staff' and staff_id = current_profile_id());

create policy wallet_ledger_admin on wallet_ledger
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy wallet_ledger_own on wallet_ledger
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'staff' and staff_id = current_profile_id());

create policy staff_payout_methods_admin on staff_payout_methods
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy staff_payout_methods_own on staff_payout_methods
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'staff' and staff_id = current_profile_id());

create policy payout_requests_admin on payout_requests
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'admin');
create policy payout_requests_own on payout_requests
  for select to authenticated
  using (tenant_id = current_tenant_id() and current_app_role() = 'staff' and staff_id = current_profile_id());
