-- Lane A inc-3g: add staff performance metrics to staff_details so the admin Staff roster can read
-- real composite/quality/on-time/throughput/trend (was mock-only). NON-money (perf ≠ pay; pay stays
-- in the gated staff_wallet domain). Additive columns — existing tenant+role RLS still applies.
alter table staff_details
  add column composite  int   not null default 0,
  add column quality    int   not null default 0,
  add column on_time    int   not null default 0,
  add column throughput int   not null default 0,
  add column trend      int[] not null default '{}';
