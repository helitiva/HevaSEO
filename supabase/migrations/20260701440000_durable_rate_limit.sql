-- HARDENING — durable, multi-instance rate limiter for the money checkout endpoint. The route's
-- previous limiter was an in-memory Map (per server instance; resets on restart; useless behind >1
-- instance — see review). This is a single-row-per-bucket sliding-window counter in Postgres, callable
-- only by service_role (the checkout route holds a service client). The /r/:code click limiter stays
-- in-memory by design (low-stakes, also cookie-deduped).
create table if not exists rate_limits (
  bucket       text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);
alter table rate_limits enable row level security;  -- no policy → only service_role / definer touch it

-- rate_hit: increment the bucket; reset the window if it has elapsed. Returns TRUE when the call is
-- within p_max for the current window, FALSE when it exceeds it. Atomic via INSERT..ON CONFLICT.
create or replace function rate_hit(p_key text, p_max int, p_window_secs int)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare v_now timestamptz := now(); v_cnt int;
begin
  insert into rate_limits(bucket, count, window_start)
       values (p_key, 1, v_now)
  on conflict (bucket) do update
     set count = case when rate_limits.window_start < v_now - make_interval(secs => p_window_secs)
                      then 1 else rate_limits.count + 1 end,
         window_start = case when rate_limits.window_start < v_now - make_interval(secs => p_window_secs)
                      then v_now else rate_limits.window_start end
  returning count into v_cnt;
  return v_cnt <= p_max;
end $$;

revoke execute on function rate_hit(text, int, int) from public;
grant  execute on function rate_hit(text, int, int) to service_role;
