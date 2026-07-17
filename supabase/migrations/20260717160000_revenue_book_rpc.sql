-- The money book, computed in SQL.
--
-- THE BUG THIS CLOSES. getRevenueBook() read credit_ledger, orders and customer_balances with unbounded
-- select()s and summed them in Node. PostgREST caps every response at max_rows (1000, see
-- supabase/config.toml) and it does NOT error when it truncates — it just returns fewer rows. At 1,001
-- ledger rows the book would have started reporting wrong deposits, wrong recognized, wrong deferred,
-- silently, forever. Worse, those queries had no ORDER BY, so the surviving 1,000 rows were arbitrary:
-- the number would have been wrong differently on each load.
--
-- Summing 20k rows in Node was the wrong shape anyway. These are SUMs. They belong next to the data.
-- Now the row count is irrelevant — this returns one JSON object however large the ledger grows.
--
-- The definitions are the ones adminRevenue.server.ts documents, kept verbatim so the two can be read
-- against each other:
--   · DEPOSITS   — kind = 'topup' ONLY. Filtering on `amount > 0` swept in refunds (which are also
--                  positive) and reported credit handed BACK to a customer as cash collected.
--   · BOOKINGS   — order value placed; every state except 'canceled' (a cancelled order was never sold).
--   · RECOGNIZED — order value on delivered_at, for delivered/approved/completed (ASC 606).
--   · DEFERRED   — unspent credit + undelivered order value: what we owe, as credit or as work.
create or replace function revenue_book(p_window_days int default 30)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_today  date := (now() at time zone 'utc')::date;
  v_result jsonb;
begin
  -- SECURITY DEFINER bypasses RLS, so the gate is here. Admin only: this is whole-tenant money.
  if current_app_role() <> 'admin' then raise exception 'NOT_AUTHORIZED'; end if;
  if p_window_days is null or p_window_days < 1 or p_window_days > 400 then raise exception 'INVALID_WINDOW'; end if;

  with
  -- a cancelled order was never booked; its debit is undone by a refund
  ord as (
    select value, state, (created_at at time zone 'utc')::date as booked_on,
           (delivered_at at time zone 'utc')::date as delivered_on
      from orders
     where tenant_id = v_tenant and state <> 'canceled'
  ),
  led as (
    select kind, amount, order_id, (created_at at time zone 'utc')::date as at
      from credit_ledger
     where tenant_id = v_tenant
  ),
  recognized as (select * from ord where delivered_on is not null and state in ('delivered', 'approved', 'completed')),
  unearned   as (select * from ord where state in ('new', 'confirmed', 'assigned', 'in_progress', 'internal_review', 'changes_requested')),
  topups     as (select * from led where kind = 'topup'),

  -- one row per day in the window, so gaps render as zeros rather than disappearing
  days as (
    select d::date as day
      from generate_series(v_today - (p_window_days - 1), v_today, interval '1 day') d
  ),
  series as (
    select
      d.day,
      coalesce((select sum(amount)  from topups     t where t.at = d.day), 0) as deposits,
      coalesce((select sum(o.value) from ord        o where o.booked_on = d.day), 0) as bookings,
      coalesce((select sum(r.value) from recognized r where r.delivered_on = d.day), 0) as recognized
      from days d
  ),

  totals as (
    select
      coalesce((select sum(amount) from topups), 0)                                              as dep_total,
      coalesce((select sum(value)  from ord), 0)                                                 as book_total,
      coalesce((select sum(value)  from recognized), 0)                                          as rec_total,
      coalesce((select sum(amount) from topups where at = v_today), 0)                           as dep_today,
      coalesce((select sum(value)  from ord where booked_on = v_today), 0)                       as book_today,
      coalesce((select sum(value)  from recognized where delivered_on = v_today), 0)             as rec_today,
      coalesce((select sum(amount) from topups where at >= date_trunc('month', v_today)::date), 0)          as dep_mtd,
      coalesce((select sum(value)  from ord where booked_on >= date_trunc('month', v_today)::date), 0)      as book_mtd,
      coalesce((select sum(value)  from recognized where delivered_on >= date_trunc('month', v_today)::date), 0) as rec_mtd,
      coalesce((select sum(balance) from customer_balances where tenant_id = v_tenant), 0)       as unspent,
      coalesce((select sum(value)  from unearned), 0)                                            as unearned_orders,
      -- credit spent on something that isn't an order (manual/legacy adjustments)
      coalesce((select sum(-amount) from led where kind = 'debit' and order_id is null), 0)      as non_order_spend,
      -- fees kept on cancellation: they leave the wallet WITHOUT becoming an order, and cancel_order
      -- stamps them with the cancelled order's id, so they can't ride along in non_order_spend
      coalesce((select sum(-amount) from led where kind = 'cancel_fee'), 0)                      as cancel_fees
  )
  select jsonb_build_object(
    'today',  jsonb_build_object('deposits', t.dep_today, 'bookings', t.book_today, 'recognized', t.rec_today),
    'mtd',    jsonb_build_object('deposits', t.dep_mtd,   'bookings', t.book_mtd,   'recognized', t.rec_mtd),
    'total',  jsonb_build_object('deposits', t.dep_total, 'bookings', t.book_total, 'recognized', t.rec_total),
    'deferred', jsonb_build_object(
      'unspentCredit', t.unspent,
      'unearnedOrders', t.unearned_orders,
      'total', t.unspent + t.unearned_orders
    ),
    'reconcile', jsonb_build_object(
      'deposits', t.dep_total,
      'recognized', t.rec_total,
      'nonOrderSpend', t.non_order_spend,
      'cancelFees', t.cancel_fees,
      'deferred', t.unspent + t.unearned_orders,
      'balances', t.unspent,
      -- deferred = topups − recognized − nonOrderSpend − cancelFees. Derived from the wallet:
      --   balance = topups + refunds − debits − cancelFees, and debits(with order) − refunds
      --   = recognized + unearnedOrders.
      'expected', t.dep_total - t.rec_total - t.non_order_spend - t.cancel_fees,
      'ok', abs((t.dep_total - t.rec_total - t.non_order_spend - t.cancel_fees) - (t.unspent + t.unearned_orders)) < 0.01
    ),
    'days', (select coalesce(jsonb_agg(jsonb_build_object(
                      'date', to_char(s.day, 'YYYY-MM-DD'),
                      'deposits', s.deposits, 'bookings', s.bookings, 'recognized', s.recognized
                    ) order by s.day), '[]'::jsonb) from series s)
  ) into v_result
  from totals t;

  return v_result;
end $$;

revoke execute on function revenue_book(int) from public, anon;
grant  execute on function revenue_book(int) to authenticated;
