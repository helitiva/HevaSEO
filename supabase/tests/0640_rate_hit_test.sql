-- Guard for 20260701440000_durable_rate_limit: rate_hit is service-role-only and enforces the window.
begin;
select plan(6);

select has_function('rate_hit', 'rate_hit() exists');
select ok(not has_function_privilege('authenticated', 'rate_hit(text,integer,integer)', 'execute'),
  'authenticated CANNOT execute rate_hit (service-role only)');
select ok(not has_function_privilege('anon', 'rate_hit(text,integer,integer)', 'execute'),
  'anon CANNOT execute rate_hit');

-- window of 1h, max 2: first two allowed, third blocked
select ok(rate_hit('bucket-a', 2, 3600),      '1st hit allowed (count 1 <= max 2)');
select ok(rate_hit('bucket-a', 2, 3600),      '2nd hit allowed (count 2 == max 2)');
select ok(not rate_hit('bucket-a', 2, 3600),  '3rd hit blocked (count 3 > max 2)');

select * from finish();
rollback;
